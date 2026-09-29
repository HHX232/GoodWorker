import { NextRequest, NextResponse } from 'next/server'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { contextPrompt, parseContext } from '@/shared/lib/lecture/context'
import { formulaAssist, type FormulaMode } from '@/shared/lib/lecture/ai'

export const maxDuration = 90

interface Params {
  params: Promise<{ id: string }>
}

const MODES: FormulaMode[] = ['describe', 'edit', 'explain', 'photo']
const MAX_PHOTO_SIZE = 15 * 1024 * 1024
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// POST /api/lecture/[id]/formula — FormData {mode, latex?, instruction?, context?, photo?} → {latex, explanation}.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Invalid form' }, { status: 400 })
    const mode = String(form.get('mode') ?? '') as FormulaMode
    if (!MODES.includes(mode)) return NextResponse.json({ error: 'bad mode' }, { status: 400 })
    const latex = String(form.get('latex') ?? '').slice(0, 2000)
    const instruction = String(form.get('instruction') ?? '').trim().slice(0, 500)
    if ((mode === 'describe' || mode === 'edit') && !instruction) return NextResponse.json({ error: 'instruction required' }, { status: 400 })
    if ((mode === 'edit' || mode === 'explain') && !latex.trim()) return NextResponse.json({ error: 'latex required' }, { status: 400 })

    let photo: { mimeType: string; base64: string } | undefined
    if (mode === 'photo') {
      const file = form.get('photo')
      if (!(file instanceof Blob) || !ALLOWED_MIMES.has(file.type) || file.size === 0 || file.size > MAX_PHOTO_SIZE) return NextResponse.json({ error: 'UNSUPPORTED_PHOTO' }, { status: 400 })
      photo = { mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString('base64') }
    }
    const result = await formulaAssist({ lectureId: id, lecture: contextPrompt(parseContext(guard.lecture.context), guard.lecture.title), mode, latex, instruction, context: String(form.get('context') ?? ''), photo })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[POST /api/lecture/[id]/formula]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
