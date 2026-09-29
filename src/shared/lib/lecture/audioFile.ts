import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { putStudentFile, replaceStudentFile } from '@/shared/lib/studentDrive/drive'
import { getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'
import { readChunkAudio } from './audio'
import { concatAudio } from './stt'

export const AUDIO_FILE_MIME = 'audio/mp4'

/** The whole recording as one .m4a, from whatever audio is still held (S3 or DB). */
export async function buildLectureAudio(lectureId: string): Promise<Buffer | null> {
  const chunks = await prisma.lectureChunk.findMany({
    where: { lectureId, OR: [{ audioKey: { not: null } }, { audioData: { not: null } }] },
    orderBy: { seq: 'asc' },
    select: { audioKey: true, audioData: true, audioMime: true },
  })
  const parts: { bytes: Buffer; mime: string }[] = []
  for (const c of chunks) {
    const bytes = await readChunkAudio(c)
    if (bytes) parts.push({ bytes, mime: c.audioMime })
  }
  return parts.length ? concatAudio(parts) : null
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
}): Promise<void> {
  const bytes = await buildLectureAudio(opts.lectureId)
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
