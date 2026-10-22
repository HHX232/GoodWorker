import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { prisma } from '@/shared/prisma/prisma'
import { s3, S3_BUCKET } from '@/shared/s3/s3Client'

/**
 * Bytes /lecture keeps in S3 for this owner — audio ("сохранять аудио") and
 * photos placed into the notes. Part of the owner's storage quota.
 */
export async function lectureStorageBytes(ownerId: string, ownerRole: 'STUDENT' | 'TEACHER'): Promise<number> {
  // A lecture whose recording is already saved as an .m4a file is paid for by that file — don't count it twice.
  const audioFiles = ownerRole === 'STUDENT'
    ? await prisma.studentFile.findMany({ where: { studentId: ownerId, lectureNoteId: { not: null }, mimeType: { startsWith: 'audio/' } }, select: { lectureNoteId: true } })
    : await prisma.tutorFile.findMany({ where: { teacherId: ownerId, lectureNoteId: { not: null }, mimeType: { startsWith: 'audio/' } }, select: { lectureNoteId: true } })
  const inFiles = audioFiles.map(f => f.lectureNoteId!).filter(Boolean)
  const [audio, photos] = await Promise.all([
    prisma.lectureChunk.aggregate({ where: { audioKey: { not: null }, lectureId: { notIn: inFiles }, lecture: { ownerId, ownerRole } }, _sum: { audioBytes: true } }),
    prisma.lecturePhoto.aggregate({ where: { lecture: { ownerId, ownerRole } }, _sum: { sizeBytes: true } }),
  ])
  return (audio._sum.audioBytes ?? 0) + (photos._sum.sizeBytes ?? 0)
}

/** A private S3 object's bytes (lecture audio and photos are never served by public URL). */
export async function readObject(key: string): Promise<Buffer | null> {
  const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
  const bytes = await object.Body?.transformToByteArray()
  return bytes ? Buffer.from(bytes) : null
}

export async function putLecturePhoto(ownerId: string, lectureId: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const key = `lecture-photos/${ownerId}/${lectureId}/${randomUUID()}.${ext}`
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: mime }))
  return key
}

export async function putLectureAudio(ownerId: string, lectureId: string, seq: number, bytes: Buffer, mime: string): Promise<string> {
  const ext = mime.includes('mp4') || mime.includes('aac') ? 'm4a' : 'webm'
  const key = `lecture-audio/${ownerId}/${lectureId}/${seq}-${randomUUID()}.${ext}`
  // Private object: replay goes through /api/lecture/[id]/audio/[seq], never a public URL.
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: mime }))
  return key
}

export async function readChunkAudio(chunk: { audioKey: string | null; audioData: Uint8Array | null }): Promise<Buffer | null> {
  if (chunk.audioData) return Buffer.from(chunk.audioData)
  if (!chunk.audioKey) return null
  return readObject(chunk.audioKey)
}
