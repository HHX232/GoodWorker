import { NextRequest, NextResponse } from 'next/server'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { contextPrompt, parseContext } from '@/shared/lib/lecture/context'
import { graphAssist, type GraphMode } from '@/shared/lib/lecture/ai'
import { parseGraphSpec } from '@/shared/lib/lecture/graphSpec'
import { photoFromForm } from '@/shared/lib/lecture/photoInput'

export const maxDuration = 180

interface Params {
  params: Promise<{ id: string }>
}

const MODES: GraphMode[] = ['describe', 'edit', 'photo']

// POST /api/lecture/[id]/graph — FormData {mode, instruction?, spec? (JSON), photo?} → {spec}.
// DeepSeek writes a graph spec from words, a board photo (vision), or an edit
// of the current one; it's validated here, so the page only ever gets a drawable spec.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true, ai: true })
    if (guard.response) return guard.response
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Invalid form' }, { status: 400 })
    const mode = String(form.get('mode') ?? '') as GraphMode
    if (!MODES.includes(mode)) return NextResponse.json({ error: 'bad mode' }, { status: 400 })
    const instruction = String(form.get('instruction') ?? '').trim().slice(0, 600)
    if (mode !== 'photo' && !instruction) return NextResponse.json({ error: 'instruction required' }, { status: 400 })
    let current: unknown = null
    try { current = parseGraphSpec(JSON.parse(String(form.get('spec') ?? 'null'))) } catch { current = null }

    let photo: { mimeType: string; base64: string } | undefined
    if (mode === 'photo') {
      const p = await photoFromForm(form)
      if (p instanceof NextResponse) return p
      photo = p
    }
    const raw = await graphAssist({ lectureId: id, mode, lecture: contextPrompt(parseContext(guard.lecture.context), guard.lecture.title), instruction, spec: current, photo })
    const spec = parseGraphSpec(raw)
    if (!spec) return NextResponse.json({ error: 'NO_GRAPH' }, { status: 422 })
    return NextResponse.json({ spec })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/graph]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
