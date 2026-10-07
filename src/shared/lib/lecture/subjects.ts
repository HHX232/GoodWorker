import { prisma } from '@/shared/prisma/prisma'
import { MAX_FOLDER_DEPTH } from '@/shared/lib/tutorFiles/constants'
import { callAI, hasAIProvider, parseJSON } from '@/lib/openrouter'
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

const MATCH_SYSTEM = `Ты следишь, чтобы в папках конспектов не появлялись дубликаты одного предмета. Дано название предмета и список существующих папок (id, название).
Если предмет — это ТА ЖЕ учебная дисциплина, что одна из папок (другая формулировка, порядок слов, сокращение, опечатка; например «Линейная алгебра и геометрия» = «Линейная алгебра и аналитическая геометрия», «Матан» = «Математический анализ»), верни id этой папки.
Если дисциплина другая, пусть и родственная («Алгебра» ≠ «Геометрия», «Математический анализ» ≠ «Линейная алгебра»), или сомневаешься — верни null.
Ответ — только JSON: {"id": "<id папки>" | null}`

/** An existing folder the AI says is the same subject under another name; null → make a new one. */
async function similarFolderId(name: string, folders: { id: string; name: string }[]): Promise<string | null> {
  if (!folders.length || !hasAIProvider()) return null
  try {
    const list = folders.map(f => `${f.id} — ${f.name}`).join('\n')
    const raw = await callAI(MATCH_SYSTEM, `Предмет: ${name}\n\nПапки:\n${list}`, { temperature: 0, maxTokens: 60 })
    const { id } = parseJSON<{ id: string | null }>(raw)
    return folders.some(f => f.id === id) ? id : null
  } catch (e) {
    console.error('[lecture subjects] similar-folder check failed', e)
    return null // ponytail: AI down → a new folder, as before; a dupe is cheaper than a failed save
  }
}

/**
 * Student: the folder a lecture of this subject goes to. A folder of theirs
 * already named after the subject (anywhere in their drive) is reused;
 * otherwise the AI checks the lectures folder for the same subject under another
 * name («Линейная алгебра и геометрия» ≈ «…и аналитическая геометрия»), and only
 * then one is made. No subject → the lectures folder.
 */
export async function studentSubjectFolder(studentId: string, lecturesFolderId: string, subject: string): Promise<string> {
  const name = subjectFolderName(subject)
  if (!name) return lecturesFolderId
  const existing = await prisma.studentFolder.findMany({ where: { studentId, name: { equals: name, mode: 'insensitive' } }, select: { id: true, parentId: true }, orderBy: { createdAt: 'asc' } })
  const pick = existing.find(f => f.parentId === lecturesFolderId) ?? existing[0]
  if (pick) return pick.id
  const siblings = await prisma.studentFolder.findMany({ where: { studentId, parentId: lecturesFolderId }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 100 })
  const similar = await similarFolderId(name, siblings)
  if (similar) return similar
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
  const siblings = await prisma.tutorFolder.findMany({ where: { teacherId, parentId: lecturesFolderId }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 100 })
  const similar = await similarFolderId(name, siblings)
  if (similar) return similar
  if (MAX_FOLDER_DEPTH < 2) return lecturesFolderId
  return (await prisma.tutorFolder.create({ data: { teacherId, parentId: lecturesFolderId, name, ancestorIds: [lecturesFolderId] } })).id
}
