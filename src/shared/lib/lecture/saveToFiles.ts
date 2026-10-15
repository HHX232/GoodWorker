import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { after } from 'next/server'
import type { LectureNote } from '@prisma/client'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { DriveError, putStudentFile, replaceStudentFile } from '@/shared/lib/studentDrive/drive'
import { extractText } from '@/shared/lib/tutorFiles/extractText'
import { getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'

// Writing a lecture's .docx into its owner's storage (student: "Мои файлы";
// tutor: own library), tagged with the lecture so opening it returns to the
// editor. Used by "Сохранить в файлы" (export) and by the call-notes finale.

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
/** Root folder of video-call notes (lectures have «Конспекты лекций»). */
export const CALL_NOTES_FOLDER = 'Конспекты уроков'

/** «<title>.docx» with the characters file systems reject cut out. */
export function fileName(title: string, createdAt: Date): string {
  const base = (title || `Лекция ${createdAt.toISOString().slice(0, 10)}`).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 120)
  return `${base || 'Лекция'}.docx`
}

/** Tutor side: a root folder of their library by name (e.g. «Конспекты лекций»), made on first use. */
export async function ensureTutorRootFolder(teacherId: string, name: string): Promise<string> {
  const existing = await prisma.tutorFolder.findFirst({ where: { teacherId, parentId: null, name }, select: { id: true } })
  if (existing) return existing.id
  return (await prisma.tutorFolder.create({ data: { teacherId, name } })).id
}

/**
 * The .docx into `folderId`; a file saved for this lecture before is overwritten
 * where it lies (`created: false`). Sets `lecture.fileId` on the first save.
 * Throws DriveError (QUOTA_EXCEEDED / FILE_TOO_LARGE / UPLOAD_FAILED).
 */
export async function saveLectureDocx(opts: {
  lecture: Pick<LectureNote, 'id' | 'fileId'>
  ownerId: string
  role: 'STUDENT' | 'TEACHER'
  folderId: string
  bytes: Buffer
  name: string
}): Promise<{ fileId: string; folderId: string | null; name: string; created: boolean }> {
  const { lecture, ownerId, bytes, name } = opts

  if (opts.role === 'STUDENT') {
    const existing = lecture.fileId ? await prisma.studentFile.findFirst({ where: { id: lecture.fileId, studentId: ownerId } }) : null
    const file = existing
      ? await replaceStudentFile(existing, bytes, DOCX_MIME)
      : await putStudentFile({ studentId: ownerId, folderId: opts.folderId, name, mimeType: DOCX_MIME, bytes, lectureNoteId: lecture.id })
    if (!existing) await prisma.lectureNote.update({ where: { id: lecture.id }, data: { fileId: file.id } })
    return { fileId: file.id, folderId: file.folderId, name: file.name, created: !existing }
  }

  const existing = lecture.fileId ? await prisma.tutorFile.findFirst({ where: { id: lecture.fileId, teacherId: ownerId } }) : null
  const limits = await getTeacherStorageLimits(ownerId)
  if ((await getUsedBytes(ownerId)) - (existing?.sizeBytes ?? 0) + bytes.length > limits.quotaBytes) throw new DriveError('QUOTA_EXCEEDED', 413)
  const key = `tutor-files/${ownerId}/${randomUUID()}.docx`
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: DOCX_MIME, ACL: 'public-read' }))
  const data = { key, url: publicUrlForKey(key), sizeBytes: bytes.length, mimeType: DOCX_MIME, contentText: null }
  const file = existing
    ? await prisma.tutorFile.update({ where: { id: existing.id }, data })
    : await prisma.tutorFile.create({
        data: { ...data, teacherId: ownerId, folderId: opts.folderId, name, uploadedByRole: 'TEACHER', uploadedById: ownerId, lectureNoteId: lecture.id },
      })
  if (!existing) await prisma.lectureNote.update({ where: { id: lecture.id }, data: { fileId: file.id } })
  // Search inside files (same as uploads) — after the response; the call-notes finale
  // is itself already running after one, where it just goes in the background.
  const index = async () => {
    const text = await extractText(bytes, file.name, DOCX_MIME).catch(() => null)
    await prisma.tutorFile.update({ where: { id: file.id }, data: { contentText: text } }).catch(() => {})
  }
  try { after(index) } catch { void index() }
  return { fileId: file.id, folderId: file.folderId, name: file.name, created: !existing }
}
