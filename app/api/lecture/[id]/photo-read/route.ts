import { NextRequest, NextResponse } from 'next/server'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { contextPrompt, parseContext } from '@/shared/lib/lecture/context'
import { readPhoto } from '@/shared/lib/lecture/ai'
import { markdownToBlocks } from '@/shared/lib/lecture/markdownToDoc'
import { photoFromForm } from '@/shared/lib/lecture/photoInput'

export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/lecture/[id]/photo-read — FormData {photo, context} → {blocks}: the photo's content as notes.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const form = await req.formData().catch(() => null)
    const photo = await photoFromForm(form)
    if (photo instanceof NextResponse) return photo
    const markdown = await readPhoto({ lectureId: id, lecture: contextPrompt(parseContext(guard.lecture.context), guard.lecture.title), context: String(form?.get('context') ?? ''), photo })
    return NextResponse.json({ blocks: markdownToBlocks(markdown), markdown })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/photo-read]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
