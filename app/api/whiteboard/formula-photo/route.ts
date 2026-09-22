import { prisma } from '@/shared/prisma/prisma'
import { AIUsage, callVisionAI, parseJSON } from '@/lib/openrouter'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { chargeForAICall, InsufficientBalanceError, insufficientBalanceResponse, preflightCheck, WalletUser } from '@/shared/lib/wallet/wallet'

export const maxDuration = 60

const ENDPOINT = 'whiteboard/formula-photo'

/** Billing falls on the room owner, not whoever clicked the button on the board — same subject the old VIP check used. */
function roomOwnerWalletUser(room: { ownerId: string; ownerRole: string }): WalletUser {
  return { id: room.ownerId, role: room.ownerRole === 'STUDENT' ? 'STUDENT' : 'TEACHER' }
}

const MAX_PHOTO_SIZE = 15 * 1024 * 1024 // DeepSeek caps at 32 MiB, base64 inflates ~33%
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const roomName = formData.get('roomName')
    if (typeof roomName !== 'string' || !roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

    const room = await prisma.videoCallRoom.findUnique({
      where: { name: roomName },
      select: { ownerId: true, ownerRole: true },
    })
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

    // Billed to the room owner, not the caller — a student in a teacher's
    // room shouldn't be charged for the teacher's own balance, and vice versa.
    const payer = roomOwnerWalletUser(room)

    const photo = formData.get('photo')
    if (!(photo instanceof Blob)) return NextResponse.json({ error: 'photo required' }, { status: 400 })
    if (!ALLOWED_MIMES.has(photo.type)) return NextResponse.json({ error: 'Unsupported photo format — use JPG, PNG, WEBP or GIF' }, { status: 400 })
    if (photo.size === 0) return NextResponse.json({ error: 'Empty photo' }, { status: 400 })
    if (photo.size > MAX_PHOTO_SIZE) return NextResponse.json({ error: `Photo too large (max ${MAX_PHOTO_SIZE / 1024 / 1024}MB)` }, { status: 400 })

    const description = (formData.get('description') ?? '').toString().trim().slice(0, 300)

    const buf = Buffer.from(await photo.arrayBuffer())
    const base64 = buf.toString('base64')

    const systemPrompt = 'Ты — ассистент репетитора, распознающий математические формулы с фото. Возвращай ТОЛЬКО валидный JSON без markdown и без пояснений на естественном языке.'
    const userPrompt = `На фото — рукописная или печатная математическая формула.${description ? ` Пользователь уточнил, какую формулу распознать: "${description}".` : ''}

Если на фото ОДНА формула, или описание пользователя однозначно указывает, какую формулу распознавать среди нескольких — верни JSON вида:
{"latex": "<LaTeX-код формулы для редактора MathLive — без окружений \\\\[ \\\\], без $, без markdown, без пояснений; используй стандартные макросы \\\\frac, \\\\sqrt, \\\\sum, \\\\int, \\\\cdot, ^, _, \\\\left(...\\\\right), \\\\begin{cases}...\\\\end{cases}>"}

Если на фото НЕСКОЛЬКО формул (или часть решения из нескольких строк) и по описанию нельзя однозначно понять, какую нужно распознать — верни JSON вида:
{"needsClarification": true, "candidates": ["<latex1>", "<latex2>", "..."]}`

    const at = new Date()
    try {
      await preflightCheck(payer, ENDPOINT, userPrompt.length, at)
    } catch (e) {
      if (e instanceof InsufficientBalanceError) return insufficientBalanceResponse(e)
      throw e
    }

    let raw: string
    let usage: AIUsage
    try {
      ;({ content: raw, usage } = await callVisionAI(systemPrompt, [{ mimeType: photo.type, base64 }], userPrompt, { temperature: 0.1 }))
    } catch (e) {
      console.error('[POST /api/whiteboard/formula-photo] vision AI error:', e)
      return NextResponse.json({ error: 'Не удалось распознать фото' }, { status: 500 })
    }

    const parsed = parseJSON<{ latex?: string; needsClarification?: boolean; candidates?: string[] }>(raw)

    // Only reached once the AI's response parsed as valid JSON — an invalid/
    // malformed response never reaches here (parseJSON throws, caught by the
    // outer try/catch below, no charge).
    const { costCents: chargedCents } = await chargeForAICall(payer, ENDPOINT, usage, at)

    if (parsed.needsClarification) {
      const candidates = (parsed.candidates ?? []).filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      if (candidates.length === 0) return NextResponse.json({ error: 'Не удалось распознать формулу — уточните описание' }, { status: 422 })
      return NextResponse.json({ needsClarification: true, candidates, chargedCents })
    }

    if (!parsed.latex?.trim()) return NextResponse.json({ error: 'Не удалось распознать формулу' }, { status: 422 })

    return NextResponse.json({ latex: parsed.latex, chargedCents })
  } catch (error) {
    console.error('[POST /api/whiteboard/formula-photo]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
  }
}
