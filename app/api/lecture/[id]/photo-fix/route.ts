import { NextRequest, NextResponse } from 'next/server'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { contextPrompt, parseContext } from '@/shared/lib/lecture/context'
import { fixFragmentWithPhoto } from '@/shared/lib/lecture/ai'
import { markdownToBlocks } from '@/shared/lib/lecture/markdownToDoc'

export const maxDuration = 180

interface Params {
  params: Promise<{ id: string }>
}

const MAX_PHOTO_SIZE = 15 * 1024 * 1024 // DeepSeek caps at 32 MiB, base64 inflates ~33%
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// POST /api/lecture/[id]/photo-fix — FormData {photo, selection, context} →
// {blocks} replacing the selected fragment, read off a board/slide photo by
// the DeepSeek vision model. The photo itself isn't stored.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response

    const form = await req.formData().catch(() => null)
    const photo = form?.get('photo')
    if (!(photo instanceof Blob)) return NextResponse.json({ error: 'photo required' }, { status: 400 })
    if (!ALLOWED_MIMES.has(photo.type)) return NextResponse.json({ error: 'UNSUPPORTED_PHOTO' }, { status: 400 })
    if (photo.size === 0 || photo.size > MAX_PHOTO_SIZE) return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 400 })
    const selection = (form?.get('selection') ?? '').toString().trim()
    if (!selection) return NextResponse.json({ error: 'selection required' }, { status: 400 })
    const context = (form?.get('context') ?? '').toString()

    const base64 = Buffer.from(await photo.arrayBuffer()).toString('base64')
    const markdown = await fixFragmentWithPhoto({ lectureId: id, lecture: contextPrompt(parseContext(guard.lecture.context), guard.lecture.title), selection, context, photo: { mimeType: photo.type, base64 } })
    return NextResponse.json({ blocks: markdownToBlocks(markdown), markdown })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/photo-fix]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
