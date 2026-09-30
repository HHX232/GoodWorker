import { prisma } from '@/shared/prisma/prisma'
import { MAX_FOLDER_DEPTH } from '@/shared/lib/tutorFiles/constants'
import { parseContext } from './context'

// Lecture notes are filed by subject: «Конспекты лекций/<Предмет>». The
// subject is the lecture context's `subject` (the AI keeps it current, the
// student can pin it). Also the "Предмет" filter in the files search.

/** "математический анализ " → "Математический анализ" (a folder name). */
export function subjectFolderName(subject: string): string {
  const s = subject.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return s ? s[0].toLocaleUpperCase('ru') + s.slice(1) : ''
}

export const sameSubject = (a: string, b: string) => subjectFolderName(a).toLocaleLowerCase('ru') === subjectFolderName(b).toLocaleLowerCase('ru')

/** The owner's lectures with their subject (only those that have one). */
export async function lectureSubjects(ownerId: string, role: 'STUDENT' | 'TEACHER'): Promise<{ id: string; subject: string }[]> {
  const rows = await prisma.lectureNote.findMany({ where: { ownerId, ownerRole: role === 'STUDENT' ? 'STUDENT' : { in: ['TEACHER', 'ADMIN'] } }, select: { id: true, context: true } })
  return rows.map(r => ({ id: r.id, subject: subjectFolderName(parseContext(r.context).subject) })).filter(r => r.subject)
}

/** Distinct subjects for the filter, as folder names, alphabetically. */
export async function subjectList(ownerId: string, role: 'STUDENT' | 'TEACHER'): Promise<string[]> {
  const seen = new Map<string, string>()
  for (const { subject } of await lectureSubjects(ownerId, role)) {
    const key = subject.toLocaleLowerCase('ru')
    if (!seen.has(key)) seen.set(key, subject)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'ru'))
}

/**
 * Student: the folder a lecture of this subject goes to. A folder of theirs
 * already named after the subject (anywhere in their drive) is reused;
 * otherwise one is made inside the lectures folder. No subject → the lectures folder.
 */
export async function studentSubjectFolder(studentId: string, lecturesFolderId: string, subject: string): Promise<string> {
  const name = subjectFolderName(subject)
  if (!name) return lecturesFolderId
  const existing = await prisma.studentFolder.findMany({ where: { studentId, name: { equals: name, mode: 'insensitive' } }, select: { id: true, parentId: true }, orderBy: { createdAt: 'asc' } })
  const pick = existing.find(f => f.parentId === lecturesFolderId) ?? existing[0]
  if (pick) return pick.id
  return (await prisma.studentFolder.create({ data: { studentId, parentId: lecturesFolderId, name, ancestorIds: [lecturesFolderId] } })).id
}

/**
 * Tutor: the same, but only folders inside the lectures folder are reused — a
 * library folder called «Математика» may be shared with students, and notes
 * must not land there on their own.
 */
export async function tutorSubjectFolder(teacherId: string, lecturesFolderId: string, subject: string): Promise<string> {
  const name = subjectFolderName(subject)
  if (!name) return lecturesFolderId
  const existing = await prisma.tutorFolder.findFirst({ where: { teacherId, parentId: lecturesFolderId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } })
  if (existing) return existing.id
  if (MAX_FOLDER_DEPTH < 2) return lecturesFolderId
  return (await prisma.tutorFolder.create({ data: { teacherId, parentId: lecturesFolderId, name, ancestorIds: [lecturesFolderId] } })).id
}
