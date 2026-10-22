import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { readObject } from '@/shared/lib/lecture/audio'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string; photoId: string }>
}

// GET /api/lecture/[id]/photos/[photoId] — the image for the editor, through
// our API (the bucket's public domain gets flagged as dangerous by browsers).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, photoId } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const photo = await prisma.lecturePhoto.findFirst({ where: { id: photoId, lectureId: id } })
    const bytes = photo ? await readObject(photo.key) : null
    if (!photo || !bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': photo.mimeType,
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
        // Photos never change (a crop is a new photo) — cache hard in the browser.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    console.error('[GET /api/lecture/[id]/photos/[photoId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — frees the quota; the editor calls it when a photo node is replaced by its crop.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id, photoId } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    await prisma.lecturePhoto.deleteMany({ where: { id: photoId, lectureId: id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/lecture/[id]/photos/[photoId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
