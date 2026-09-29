import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { prisma } from '@/shared/prisma/prisma'
import { s3, S3_BUCKET } from '@/shared/s3/s3Client'

/** Bytes of lecture audio kept in S3 ("сохранять аудио" on) — part of the owner's storage quota. */
export async function lectureAudioBytes(ownerId: string, ownerRole: 'STUDENT' | 'TEACHER'): Promise<number> {
  const r = await prisma.lectureChunk.aggregate({
    where: { audioKey: { not: null }, lecture: { ownerId, ownerRole } },
    _sum: { audioBytes: true },
  })
  return r._sum.audioBytes ?? 0
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
  const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: chunk.audioKey }))
  const bytes = await object.Body?.transformToByteArray()
  return bytes ? Buffer.from(bytes) : null
}
