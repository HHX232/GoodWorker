import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { readChunkAudio } from '@/shared/lib/lecture/audio'
import { markDoubtful, transcribe } from '@/shared/lib/lecture/stt'
import { parseContext, sttHint } from '@/shared/lib/lecture/context'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

// A FINALIZING lecture untouched this long is treated as orphaned (server
// restarted mid-pass) — calling finish again resumes it.
const STALE_MS = 10 * 60_000

/**
 * The hybrid's second half: every chunk still without `finalText` goes
 * through the big model, in order (previous final text as the prompt). The
 * temporary DB audio is dropped as soon as its chunk is final — S3 audio
 * ("сохранять аудио") stays. Chunks the big model fails on keep their draft
 * and their audio, so calling finish again on a READY lecture retries them.
 */
async function finalPass(lectureId: string, hint: string): Promise<void> {
  const chunks = await prisma.lectureChunk.findMany({ where: { lectureId, finalText: null }, orderBy: { seq: 'asc' }, select: { id: true, seq: true, audioKey: true, audioData: true, audioMime: true } })
  let prevText = ''
  for (const chunk of chunks) {
    try {
      const audio = await readChunkAudio(chunk)
      if (audio) {
        const result = await transcribe(audio, chunk.audioMime, 'final', `${hint}. ${prevText}`)
        prevText = result.text
        await prisma.lectureChunk.update({ where: { id: chunk.id }, data: { finalText: markDoubtful(result), audioData: null } })
      }
    } catch (e) {
      // Draft stays and so does the audio — "finish" again retries just these chunks.
      console.error(`[lecture finish] chunk ${chunk.seq} failed, keeping the draft`, e)
    }
    await prisma.lectureNote.update({ where: { id: lectureId }, data: { updatedAt: new Date() } }).catch(() => {})
  }
  await prisma.lectureNote.update({ where: { id: lectureId }, data: { status: 'READY' } })
}

// POST /api/lecture/[id]/finish — "Стоп": RECORDING → FINALIZING, the final
// pass runs after the response; the page polls GET until READY.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const { lecture } = guard

    if (lecture.status === 'READY') {
      const retry = await prisma.lectureChunk.count({ where: { lectureId: id, finalText: null, OR: [{ audioData: { not: null } }, { audioKey: { not: null } }] } })
      if (!retry) return NextResponse.json({ status: 'READY' })
    }
    if (lecture.status === 'FINALIZING' && Date.now() - lecture.updatedAt.getTime() < STALE_MS) return NextResponse.json({ status: 'FINALIZING' })

    // Atomic claim so two tabs can't both start a pass.
    const { count } = await prisma.lectureNote.updateMany({
      where: { id, status: lecture.status, updatedAt: lecture.updatedAt },
      data: { status: 'FINALIZING' },
    })
    if (!count) return NextResponse.json({ status: 'FINALIZING' })

    after(() => finalPass(id, sttHint(parseContext(lecture.context), lecture.title)).catch(async e => {
      console.error('[lecture finish] final pass crashed', e)
      await prisma.lectureNote.update({ where: { id }, data: { status: 'READY' } }).catch(() => {})
    }))
    return NextResponse.json({ status: 'FINALIZING' })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/finish]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
