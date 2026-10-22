import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { readObject } from '@/shared/lib/lecture/audio'
import { resolveShare } from '@/shared/lib/lecture/share'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ token: string; photoId: string }>
}

// GET /api/lecture/shared/[token]/photos/[photoId] — a photo of a shared
// lecture, streamed through our API (never the bucket's public URL).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token, photoId } = await params
    const share = await resolveShare(token)
    if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const photo = await prisma.lecturePhoto.findFirst({ where: { id: photoId, lectureId: share.lecture.id } })
    const bytes = photo ? await readObject(photo.key) : null
    if (!photo || !bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': photo.mimeType,
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
        // private: a revoked link must stop working, no shared caches in between.
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error('[GET /api/lecture/shared/[token]/photos/[photoId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — edit links only (the editor drops the original when a photo is replaced by its crop).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { token, photoId } = await params
    const share = await resolveShare(token)
    if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (share.mode !== 'edit') return NextResponse.json({ error: 'READ_ONLY' }, { status: 403 })
    await prisma.lecturePhoto.deleteMany({ where: { id: photoId, lectureId: share.lecture.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/lecture/shared/[token]/photos/[photoId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
