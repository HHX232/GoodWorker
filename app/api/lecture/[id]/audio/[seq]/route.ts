import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { readChunkAudio } from '@/shared/lib/lecture/audio'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string; seq: string }>
}

// GET /api/lecture/[id]/audio/[seq] — replay one chunk ("переслушать место").
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, seq } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const n = Number(seq)
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'Bad seq' }, { status: 400 })
    const chunk = await prisma.lectureChunk.findUnique({ where: { lectureId_seq: { lectureId: id, seq: n } }, select: { audioKey: true, audioData: true, audioMime: true } })
    const bytes = chunk ? await readChunkAudio(chunk) : null
    if (!chunk || !bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': chunk.audioMime.startsWith('audio/') ? chunk.audioMime : 'application/octet-stream',
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    console.error('[GET /api/lecture/[id]/audio/[seq]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
