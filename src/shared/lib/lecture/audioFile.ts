import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { putStudentFile, replaceStudentFile } from '@/shared/lib/studentDrive/drive'
import { getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'
import { readChunkAudio } from './audio'
import { parseGraphSpec } from './graphSpec'
import { addM4aChapters, type AudioChapter } from './m4aChapters'
import { nodeText, type PMNode } from './markdownToDoc'
import { concatAudio } from './stt'

export const AUDIO_FILE_MIME = 'audio/mp4'

type MarkerKind = 'formula' | 'graph' | 'board' | 'photo'
const MARKER_LABELS: Record<'ru' | 'en', Record<MarkerKind | 'start', string>> = {
  ru: { start: 'Начало', formula: 'Формула', graph: 'График', board: 'Доска', photo: 'Фото' },
  en: { start: 'Start', formula: 'Formula', graph: 'Graph', board: 'Board', photo: 'Photo' },
}
const KIND_OF: Record<string, MarkerKind> = { mathBlock: 'formula', graphBlock: 'graph', boardBlock: 'board', lecturePhoto: 'photo' }
/** Kind markers closer than this to the previous marker are dropped — a pin per idea, not per formula. */
const MIN_GAP_MS = 20_000

interface Span { seq: number; startMs: number; durationMs: number }

/**
 * Chapter markers from the notes, in lecture time: every AI section is a chapter named
 * by its first heading (or opening words); formulas, graphs, boards and photos inside it
 * get their own pin, timed by where they sit in the section's stretch of audio.
 */
export function lectureMarkers(doc: PMNode | null, chunks: Span[], lang: string, title: string): AudioChapter[] {
  const L = MARKER_LABELS[lang === 'ru' ? 'ru' : 'en']
  const bySeq = new Map(chunks.map(c => [c.seq, c]))
  // `section` pins win over a nearby start / kind pin; kind pins yield to anything close before them.
  const out: (AudioChapter & { section: boolean })[] = [{ ms: 0, title: title.trim() || L.start, section: false }]
  let lastEnd = 0
  const pin = (ms: number, text: string, section: boolean) => {
    const prev = out[out.length - 1]
    if (ms - prev.ms < MIN_GAP_MS) {
      if (!section) return
      if (!prev.section) out.pop()
    }
    out.push({ ms, title: text, section })
  }
  const kindTitle = (n: PMNode, kind: MarkerKind) => {
    const spec = kind === 'graph' ? parseGraphSpec(n.attrs?.spec) : null
    return spec?.title ? `${L.graph}: ${spec.title}` : L[kind]
  }
  for (const node of doc?.content ?? []) {
    if (node.type !== 'aiSection') {
      const kind = KIND_OF[node.type]
      if (kind) pin(lastEnd, kindTitle(node, kind), false)
      continue
    }
    const from = Number(node.attrs?.fromSeq)
    const to = Number(node.attrs?.toSeq)
    const start = Number(node.attrs?.startMs) || bySeq.get(from)?.startMs || 0
    const last = bySeq.get(to)
    const end = last ? last.startMs + last.durationMs : start
    const kids = node.content ?? []
    const heading = kids.find(k => k.type === 'heading')
    const topic = nodeText(heading ?? kids.find(k => nodeText(k).trim()) ?? { type: 'text', text: '' }).replace(/\$[^$]*\$/g, '').replace(/\s+/g, ' ').trim()
    pin(start, topic.length > 70 ? `${topic.slice(0, 68)}…` : topic || L.start, true)
    // Position inside the section ≈ position in its audio (by amount of text).
    const lens = kids.map(k => Math.max(1, nodeText(k).length))
    const total = lens.reduce((a, b) => a + b, 0)
    let acc = 0
    kids.forEach((k, i) => {
      const kind = KIND_OF[k.type]
      if (kind) pin(Math.round(start + ((end - start) * acc) / total), kindTitle(k, kind), false)
      acc += lens[i]
    })
    lastEnd = Math.max(lastEnd, end)
  }
  return out.map(({ ms, title: t }) => ({ ms, title: t }))
}

/** Lecture time → time in the glued audio (chunks without audio are simply missing from it). */
function toAudioTime(markers: AudioChapter[], included: Span[]): AudioChapter[] {
  let offset = 0
  const spans = included.map(c => { const o = offset; offset += c.durationMs; return { ...c, offset: o } })
  return markers.map(m => {
    const hit = spans.find(c => m.ms < c.startMs + c.durationMs)
    if (!hit) return { ...m, ms: offset }
    return { ...m, ms: hit.offset + Math.max(0, m.ms - hit.startMs) }
  })
}

/**
 * The whole recording as one .m4a, from whatever audio is still held (S3 or DB),
 * with chapter markers from the notes (see lectureMarkers).
 */
export async function buildLectureAudio(lectureId: string, lang = 'ru'): Promise<Buffer | null> {
  const chunks = await prisma.lectureChunk.findMany({
    where: { lectureId, OR: [{ audioKey: { not: null } }, { audioData: { not: null } }] },
    orderBy: { seq: 'asc' },
    select: { seq: true, startMs: true, durationMs: true, audioKey: true, audioData: true, audioMime: true },
  })
  const parts: { bytes: Buffer; mime: string }[] = []
  const included: Span[] = []
  for (const c of chunks) {
    const bytes = await readChunkAudio(c)
    if (bytes) { parts.push({ bytes, mime: c.audioMime }); included.push(c) }
  }
  if (!parts.length) return null
  const m4a = await concatAudio(parts)
  const [lecture, all] = await Promise.all([
    prisma.lectureNote.findUnique({ where: { id: lectureId }, select: { docJson: true, title: true } }),
    prisma.lectureChunk.findMany({ where: { lectureId }, select: { seq: true, startMs: true, durationMs: true } }),
  ])
  const markers = lectureMarkers((lecture?.docJson ?? null) as PMNode | null, all, lang, lecture?.title ?? '')
  return addM4aChapters(m4a, toAudioTime(markers, included))
}

/**
 * Saves (or refreshes) the lecture's recording as `<name>.m4a` next to its .docx in the
 * owner's files. Tagged with lectureNoteId like the .docx; the audio mime tells them apart.
 * Its chunk audio then stops counting toward the quota (see lectureStorageBytes).
 */
export async function saveLectureAudioFile(opts: {
  lectureId: string
  owner: { id: string; role: 'STUDENT' | 'TEACHER' }
  folderId: string | null
  baseName: string
  /** Language of the chapter labels ("Формула", "График"…). */
  lang?: string
}): Promise<void> {
  const bytes = await buildLectureAudio(opts.lectureId, opts.lang)
  if (!bytes) return
  const name = `${opts.baseName}.m4a`
  if (opts.owner.role === 'STUDENT') {
    const existing = await prisma.studentFile.findFirst({ where: { studentId: opts.owner.id, lectureNoteId: opts.lectureId, mimeType: { startsWith: 'audio/' } } })
    if (existing) await replaceStudentFile(existing, bytes, AUDIO_FILE_MIME)
    else await putStudentFile({ studentId: opts.owner.id, folderId: opts.folderId, name, mimeType: AUDIO_FILE_MIME, bytes, lectureNoteId: opts.lectureId })
    return
  }
  const existing = await prisma.tutorFile.findFirst({ where: { teacherId: opts.owner.id, lectureNoteId: opts.lectureId, mimeType: { startsWith: 'audio/' } } })
  const limits = await getTeacherStorageLimits(opts.owner.id)
  if (bytes.length > limits.maxFileBytes) throw new Error('FILE_TOO_LARGE')
  if ((await getUsedBytes(opts.owner.id)) - (existing?.sizeBytes ?? 0) + bytes.length > limits.quotaBytes) throw new Error('QUOTA_EXCEEDED')
  const key = `tutor-files/${opts.owner.id}/${randomUUID()}.m4a`
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: AUDIO_FILE_MIME, ACL: 'public-read' }))
  const data = { key, url: publicUrlForKey(key), sizeBytes: bytes.length, mimeType: AUDIO_FILE_MIME, contentText: null }
  if (existing) await prisma.tutorFile.update({ where: { id: existing.id }, data })
  else await prisma.tutorFile.create({ data: { ...data, teacherId: opts.owner.id, folderId: opts.folderId, name, uploadedByRole: 'TEACHER', uploadedById: opts.owner.id, lectureNoteId: opts.lectureId } })
}
