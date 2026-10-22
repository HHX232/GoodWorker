import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import { findFileVisibleToStudent, loadStudentVisibility, type FilesSessionUser } from './access'
import { grantStudentSelect, loadOpens, people, type TutorFileRow } from './readModel'

export * from './bookModel'
import { coverKeyOf, toBook } from './bookModel'

/**
 * The book if `user` may read it: the owning tutor, or a student with an
 * active grant (`findFileVisibleToStudent`). Not a book / no access → null
 * (routes answer 403, like /files/[id]/content).
 */
export async function canReadBook(user: FilesSessionUser, id: string): Promise<TutorFileRow | null> {
  const file = user.role === 'TEACHER'
    ? await prisma.tutorFile.findFirst({ where: { id, teacherId: user.id } })
    : await findFileVisibleToStudent(id, user.id)
  return file?.isBook ? file : null
}

/**
 * Every book the viewer sees, newest first: the tutor's own, or — for a
 * student — those with an active grant, across all tutors. Pass `studentFiles`
 * (already loaded visibility) to skip the second visibility query.
 */
export async function loadBooksFor(user: FilesSessionUser, studentFiles?: TutorFileRow[]): Promise<LibraryBook[]> {
  const isTeacher = user.role === 'TEACHER'
  const rows = isTeacher
    ? await prisma.tutorFile.findMany({
        where: { teacherId: user.id, isBook: true },
        include: { grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      })
    : (studentFiles ?? (await loadStudentVisibility(user.id)).files)
        .filter(f => f.isBook)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(f => ({ ...f, grants: [] as GrantsRow[] }))
  return toBooksFor(user, rows)
}

type GrantsRow = { studentId: string; student: { id: string; name: string; avatarUrl: string | null } }

/** Rows → LibraryBook[] for `user`: tutor names, their saved/progress state and (tutor view) sharing + first opens, in 4 queries. */
export async function toBooksFor(user: FilesSessionUser, rows: (TutorFileRow & { grants: GrantsRow[] })[]): Promise<LibraryBook[]> {
  if (rows.length === 0) return []
  const isTeacher = user.role === 'TEACHER'
  const ids = rows.map(r => r.id)
  const teacherIds = [...new Set(rows.map(r => r.teacherId))]
  const [teachers, saves, progress, opened] = await Promise.all([
    prisma.teacher.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true } }),
    prisma.tutorBookSave.findMany({ where: { ownerId: user.id, fileId: { in: ids } }, select: { fileId: true } }),
    prisma.tutorBookProgress.findMany({ where: { ownerId: user.id, fileId: { in: ids } }, select: { fileId: true, lastPage: true, updatedAt: true } }),
    isTeacher ? loadOpens([], ids) : undefined,
  ])
  const teacherName = new Map(teachers.map(t => [t.id, t.name]))
  const saved = new Set(saves.map(s => s.fileId))
  const progressOf = new Map(progress.map(p => [p.fileId, p]))
  return rows.map(r => toBook(r, {
    teacherName: teacherName.get(r.teacherId) ?? '',
    saved: saved.has(r.id),
    progress: progressOf.get(r.id) ?? null,
    sharedWith: people(r.id, r.grants, opened ?? (() => undefined)),
  }))
}

/** Best-effort removal of S3 objects (book deleted, cover replaced, a failed write rolled back): a failure is logged and never blocks the caller. */
export async function deleteS3Objects(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    } catch (e) {
      console.error('[books] S3 cleanup failed', key, e)
    }
  }
}

/** Removes the cover object of an existing book (by its public URL). */
export async function deleteBookCover(coverUrl: string | null): Promise<void> {
  const key = coverUrl ? coverKeyOf(coverUrl) : null
  if (key) await deleteS3Objects([key])
}

const COVER_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' }
/** A cover is a ready 2:3 image cropped on the client — small by construction. */
export const MAX_COVER_BYTES = 5 * 1024 * 1024

/** Error code for a bad `cover` upload (PNG/JPEG, ≤ 5 MB), or null when it is fine. */
export function coverProblem(cover: File): 'COVER_INVALID' | 'COVER_TOO_LARGE' | null {
  if (!COVER_TYPES[cover.type]) return 'COVER_INVALID'
  return cover.size > MAX_COVER_BYTES ? 'COVER_TOO_LARGE' : null
}

/** Puts a validated cover on S3 under `tutor-files/<teacher>/covers/<uuid>.<ext>`; returns its key and public URL. Throws on S3 failure. */
export async function uploadBookCover(teacherId: string, cover: File): Promise<{ key: string; url: string }> {
  const key = `tutor-files/${teacherId}/covers/${randomUUID()}.${COVER_TYPES[cover.type]}`
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: Buffer.from(await cover.arrayBuffer()),
    ContentType: cover.type,
    ACL: 'public-read',
  }))
  return { key, url: publicUrlForKey(key) }
}
