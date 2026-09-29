import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { putLectureAudio } from '@/shared/lib/lecture/audio'
import { getLectureSettings, lectureCostKopecks, minutesRecordedToday } from '@/shared/lib/lecture/pricing'
import { ownerFreeBytes } from '@/shared/lib/lecture/quota'
import { markDoubtful, SttBusyError, transcribe } from '@/shared/lib/lecture/stt'

export const runtime = 'nodejs'
export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

const MAX_CHUNK_BYTES = 8 * 1024 * 1024
const MAX_CHUNK_MS = 60_000

function intField(form: FormData, name: string): number | null {
  const v = Number(form.get(name))
  return Number.isInteger(v) && v >= 0 ? v : null
}

// POST /api/lecture/[id]/chunks — FormData {audio, seq, startMs, durationMs}.
// One ~20 s piece of the recording → draft transcript. Idempotent by seq: the
// client re-sends from its IndexedDB queue after a network drop, and a chunk
// already stored just returns its text. Nothing is stored when STT fails
// (503/429) — the client keeps the chunk and retries.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const { lecture, user } = guard

    const form = await req.formData().catch(() => null)
    const audio = form?.get('audio')
    if (!form || !(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: 'audio is required' }, { status: 400 })
    if (audio.size > MAX_CHUNK_BYTES) return NextResponse.json({ error: 'CHUNK_TOO_LARGE' }, { status: 413 })
    const seq = intField(form, 'seq')
    const startMs = intField(form, 'startMs')
    const durationMs = intField(form, 'durationMs')
    if (seq === null || startMs === null || durationMs === null || durationMs > MAX_CHUNK_MS) return NextResponse.json({ error: 'seq/startMs/durationMs invalid' }, { status: 400 })

    const existing = await prisma.lectureChunk.findUnique({ where: { lectureId_seq: { lectureId: id, seq } } })
    if (existing) return NextResponse.json({ seq, text: existing.finalText ?? existing.draftText, recordedMs: lecture.recordedMs, costKopecks: lecture.costKopecks, duplicate: true })
    if (lecture.status !== 'RECORDING') return NextResponse.json({ error: 'NOT_RECORDING' }, { status: 409 })

    const tariff = await getLectureSettings()
    if (!user.isAdmin && tariff.maxMinutesPerDay > 0 && (await minutesRecordedToday(user.id, user.role)) + durationMs / 60_000 > tariff.maxMinutesPerDay) {
      return NextResponse.json({ error: 'DAILY_LIMIT', maxMinutesPerDay: tariff.maxMinutesPerDay }, { status: 429 })
    }

    const bytes = Buffer.from(await audio.arrayBuffer())
    const mime = (audio.type || 'audio/webm').split(';')[0]
    const prev = seq > 0 ? await prisma.lectureChunk.findUnique({ where: { lectureId_seq: { lectureId: id, seq: seq - 1 } }, select: { draftText: true } }) : null
    let text: string
    try {
      const result = await transcribe(bytes, mime, 'draft', `${lecture.title}. ${prev?.draftText.replace(/[⟨⟩?]/g, '') ?? ''}`)
      text = markDoubtful(result)
    } catch (e) {
      if (e instanceof SttBusyError) return NextResponse.json({ error: 'STT_BUSY' }, { status: 429 })
      console.error('[POST /api/lecture/[id]/chunks] stt', e)
      return NextResponse.json({ error: 'STT_UNAVAILABLE' }, { status: 503 })
    }

    // "Сохранять аудио" on: S3, counted in the owner's quota (falls back to
    // the temporary DB copy once the quota is full). Off: DB until the final pass.
    let audioKey: string | null = null
    let audioQuotaHit = false
    if (lecture.keepAudio) {
      if ((await ownerFreeBytes(user.id, user.role)) >= bytes.length) {
        audioKey = await putLectureAudio(user.id, id, seq, bytes, mime).catch(e => { console.error('[chunks] s3 put', e); return null })
      } else {
        audioQuotaHit = true
      }
    }

    try {
      await prisma.lectureChunk.create({
        data: { lectureId: id, seq, startMs, durationMs, draftText: text, audioKey, audioData: audioKey ? null : bytes, audioMime: mime, audioBytes: bytes.length },
      })
    } catch (e) {
      // Two uploads of the same seq raced — the other one won, that's fine.
      if ((e as { code?: string }).code !== 'P2002') throw e
    }

    const agg = await prisma.lectureChunk.aggregate({ where: { lectureId: id }, _sum: { durationMs: true } })
    const recordedMs = agg._sum.durationMs ?? 0
    const updated = await prisma.lectureNote.update({
      where: { id },
      data: { recordedMs, costKopecks: lectureCostKopecks(tariff, recordedMs, lecture.aiPromptTokens, lecture.aiCompletionTokens) },
      select: { recordedMs: true, costKopecks: true },
    })
    return NextResponse.json({ seq, text, ...updated, audioQuotaHit })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/chunks]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
