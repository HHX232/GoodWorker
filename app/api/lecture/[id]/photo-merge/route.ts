import { NextRequest, NextResponse } from 'next/server'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { mergePhoto } from '@/shared/lib/lecture/ai'
import { markdownToBlocks } from '@/shared/lib/lecture/markdownToDoc'
import { photoFromForm } from '@/shared/lib/lecture/photoInput'

export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/lecture/[id]/photo-merge — FormData {photo, outline: JSON string[]}
// (the notes' blocks as text, in document order) → {items}: each fragment of
// the photo marked duplicate / continuation (after block N) / new, with its
// blocks. Nothing is written — the page shows the plan and the student applies it.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const form = await req.formData().catch(() => null)
    const photo = await photoFromForm(form)
    if (photo instanceof NextResponse) return photo
    let outline: string[] = []
    try {
      const parsed = JSON.parse(String(form?.get('outline') ?? '[]'))
      if (Array.isArray(parsed)) outline = parsed.filter((x): x is string => typeof x === 'string').slice(0, 2000)
    } catch { /* empty outline */ }
    const items = await mergePhoto({ lectureId: id, outline, photo })
    return NextResponse.json({ items: items.map(i => ({ ...i, blocks: markdownToBlocks(i.markdown) })) })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/photo-merge]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
