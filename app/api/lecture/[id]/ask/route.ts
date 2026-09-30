import { NextRequest, NextResponse } from 'next/server'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { contextPrompt, parseContext } from '@/shared/lib/lecture/context'
import { askAboutFragment } from '@/shared/lib/lecture/ai'
import { markdownToBlocks } from '@/shared/lib/lecture/markdownToDoc'

export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/lecture/[id]/ask — {selection, context, instruction, insertAfter?} → a
// suggested replacement (or, with insertAfter, an addition) {markdown, blocks}. Nothing is written: the page
// shows it next to the original and the student applies or cancels.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true, ai: true })
    if (guard.response) return guard.response
    const body = await req.json().catch(() => ({}))
    const selection = typeof body.selection === 'string' ? body.selection.trim() : ''
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''
    if (!selection || !instruction) return NextResponse.json({ error: 'selection and instruction required' }, { status: 400 })
    const markdown = await askAboutFragment({ lectureId: id, lecture: contextPrompt(parseContext(guard.lecture.context), guard.lecture.title), selection, instruction, context: typeof body.context === 'string' ? body.context : '', insertAfter: body.insertAfter === true })
    return NextResponse.json({ markdown, blocks: markdownToBlocks(markdown) })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/ask]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
