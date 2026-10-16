import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { checkRateLimit, getIp, peekRateLimit } from '@/shared/api/rate-limit'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { buildCoachPrompt, validateCoachInput } from '@/shared/lib/chess/server/coachInput'
import { callAI, hasAIProvider, parseJSON } from '@/lib/openrouter'

// Лимиты объяснений тренера (spec §4; числа — ASSUMPTION: «маленький / большой / без лимита»).
const DAY = 24 * 60 * 60 * 1000
const LIMITS = { guest: { max: 5, windowMs: DAY }, user: { max: 100, windowMs: DAY } }
const MAX_TEXT = 600

async function isVip(user: { id: string; role: 'TEACHER' | 'STUDENT' }): Promise<boolean> {
  const select = { isVip: true, vipExpiresAt: true } as const
  const row = user.role === 'TEACHER'
    ? await prisma.teacher.findUnique({ where: { id: user.id }, select })
    : await prisma.student.findUnique({ where: { id: user.id }, select })
  return !!row?.isVip && (row.vipExpiresAt == null || row.vipExpiresAt > new Date())
}

// POST /api/chess/coach — объяснение хода DeepSeek'ом по фактам движка и chess.js.
export async function POST(req: NextRequest) {
  try {
    const parsed = validateCoachInput(await req.json().catch(() => null))
    if (!parsed.ok) return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })

    const user = await getChatSessionUser()
    const tier = !user ? 'guest' : (await isVip(user)) ? 'vip' : 'user'
    // ponytail: ключ гостя — из x-forwarded-for; держится, только пока прод-прокси перезаписывает XFF (иначе гость
    // подставит любой IP), а без заголовка все гости делят один ключ 'anonymous'.
    const key = user ? `chess-coach:user:${user.id}` : `chess-coach:ip:${getIp(req)}`
    if (tier !== 'vip' && !(await peekRateLimit(key, LIMITS[tier]))) {
      return NextResponse.json({ error: 'LIMIT', tier }, { status: 429 })
    }

    if (!hasAIProvider()) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 })
    const { system, user: prompt } = buildCoachPrompt(parsed.input, parsed.facts)
    let text: string
    try {
      // callAI всегда просит response_format json_object — модель отвечает {"text": "..."}
      const raw = parseJSON<{ text?: unknown }>(await callAI(system, prompt, { temperature: 0.3, maxTokens: 400 }))
      text = typeof raw.text === 'string' ? raw.text.trim().slice(0, MAX_TEXT) : ''
    } catch (e) {
      console.error('[POST /api/chess/coach] AI failed', (e as Error).message)
      return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 })
    }
    if (!text) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 })

    // ponytail: проверка и списание разнесены — параллельные запросы на границе лимита могут дать +1 объяснение; атомарный UPDATE … RETURNING, если станет важно.
    if (tier !== 'vip') await checkRateLimit(key, LIMITS[tier])
    return NextResponse.json({ text })
  } catch (e) {
    console.error('[POST /api/chess/coach]', e)
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 })
  }
}
