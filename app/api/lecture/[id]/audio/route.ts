import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { readChunkAudio } from '@/shared/lib/lecture/audio'
import { concatAudio } from '@/shared/lib/lecture/stt'

export const runtime = 'nodejs'
export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/lecture/[id]/audio — the whole recording as one .m4a download.
// Available while audio exists: kept in S3 ("сохранять аудио"), or still
// held in the DB before the final pass.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const chunks = await prisma.lectureChunk.findMany({
      where: { lectureId: id, OR: [{ audioKey: { not: null } }, { audioData: { not: null } }] },
      orderBy: { seq: 'asc' },
      select: { audioKey: true, audioData: true, audioMime: true },
    })
    if (!chunks.length) return NextResponse.json({ error: 'NO_AUDIO' }, { status: 404 })
    const parts: { bytes: Buffer; mime: string }[] = []
    for (const c of chunks) {
      const bytes = await readChunkAudio(c)
      if (bytes) parts.push({ bytes, mime: c.audioMime })
    }
    const m4a = await concatAudio(parts)
    const name = `${(guard.lecture.title || 'lecture').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 80) || 'lecture'}.m4a`
    return new NextResponse(new Uint8Array(m4a), {
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Disposition': `attachment; filename="lecture.m4a"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[GET /api/lecture/[id]/audio]', e)
    return NextResponse.json({ error: 'AUDIO_FAILED' }, { status: 502 })
  }
}
