import { NextRequest, NextResponse } from 'next/server'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { contextPrompt, parseContext } from '@/shared/lib/lecture/context'
import { mergePhoto } from '@/shared/lib/lecture/ai'
import { markdownToBlocks } from '@/shared/lib/lecture/markdownToDoc'
import { photosFromForm } from '@/shared/lib/lecture/photoInput'

export const maxDuration = 180

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/lecture/[id]/photo-merge — FormData {photo × 1–6, outline: JSON string[]}
// (the notes' blocks as text, in document order) → {items}: each fragment of
// the photo marked duplicate / continuation (after block N) / new, with its
// blocks. Nothing is written — the page shows the plan and the student applies it.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const form = await req.formData().catch(() => null)
    // Several shots of one board go in one request — the AI sees them together and doesn't repeat what two photos share.
    const photos = await photosFromForm(form)
    if (photos instanceof NextResponse) return photos
    let outline: string[] = []
    try {
      const parsed = JSON.parse(String(form?.get('outline') ?? '[]'))
      if (Array.isArray(parsed)) outline = parsed.filter((x): x is string => typeof x === 'string').slice(0, 2000)
    } catch { /* empty outline */ }
    const items = await mergePhoto({ lectureId: id, lecture: contextPrompt(parseContext(guard.lecture.context), guard.lecture.title, guard.lecture.language), outline, photos })
    return NextResponse.json({ items: items.map(i => ({ ...i, blocks: markdownToBlocks(i.markdown) })) })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/photo-merge]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
