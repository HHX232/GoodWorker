import { prisma } from '@/shared/prisma/prisma'
import type { TutorFolder } from '@prisma/client'
import type { SubmissionProgress } from '@/shared/types/TutorFiles/tutorFiles.types'

/** A student's uploaded file and its review verdict (`null` = not reviewed yet). */
export type Upload = { folderId: string; status: string | null }
type FolderWithGrants = Pick<TutorFolder, 'id' | 'allowStudentUpload' | 'restrictedToStudentId'> & { grants: { studentId: string }[] }
type Subfolder = { id: string; parentId: string | null; restrictedToStudentId: string | null }

/** What one set of uploads adds up to: no review = waiting, REVISION = working, ACCEPTED = done. */
function tally(uploads: Upload[]): { done: number; waiting: number; working: number } {
  const t = { done: 0, waiting: 0, working: 0 }
  for (const u of uploads) {
    if (u.status === 'ACCEPTED') t.done++
    else if (u.status === 'REVISION') t.working++
    else t.waiting++
  }
  return t
}

/**
 * Pure part: a submissions folder is counted per student with access (anything
 * unreviewed beats a revision beats "all accepted"; nothing uploaded = not
 * started), a student's personal subfolder per uploaded file.
 */
export function buildSubmissionProgress(folders: FolderWithGrants[], subfolders: Subfolder[], uploads: Upload[]): Map<string, SubmissionProgress> {
  const out = new Map<string, SubmissionProgress>()
  const byFolder = new Map<string, Upload[]>()
  for (const u of uploads) byFolder.set(u.folderId, [...(byFolder.get(u.folderId) ?? []), u])

  for (const f of folders) {
    if (f.restrictedToStudentId) {
      const t = tally(byFolder.get(f.id) ?? [])
      out.set(f.id, { unit: 'files', ...t, notStarted: 0, total: t.done + t.waiting + t.working })
    } else if (f.allowStudentUpload) {
      const personal = new Map(subfolders.filter(s => s.parentId === f.id).map(s => [s.restrictedToStudentId, s.id]))
      const p: SubmissionProgress = { unit: 'students', done: 0, waiting: 0, working: 0, notStarted: 0, total: f.grants.length }
      for (const g of f.grants) {
        const t = tally(byFolder.get(personal.get(g.studentId) ?? '') ?? [])
        if (t.waiting) p.waiting++
        else if (t.working) p.working++
        else if (t.done) p.done++
        else p.notStarted++
      }
      out.set(f.id, p)
    }
  }
  return out
}

/** Progress for the homework folders in a teacher's listing, keyed by folder id. Two queries, none without homework folders. */
export async function loadSubmissionProgress(folders: FolderWithGrants[]): Promise<Map<string, SubmissionProgress>> {
  const dropboxes = folders.filter(f => f.allowStudentUpload && !f.restrictedToStudentId)
  const personal = folders.filter(f => f.restrictedToStudentId)
  if (dropboxes.length === 0 && personal.length === 0) return new Map()

  const subfolders = dropboxes.length
    ? await prisma.tutorFolder.findMany({
        where: { parentId: { in: dropboxes.map(f => f.id) }, restrictedToStudentId: { not: null } },
        select: { id: true, parentId: true, restrictedToStudentId: true },
      })
    : []
  const rows = await prisma.tutorFile.findMany({
    where: { folderId: { in: [...personal.map(f => f.id), ...subfolders.map(f => f.id)] }, uploadedByRole: 'STUDENT' },
    select: { folderId: true, review: { select: { status: true } } },
  })
  const uploads: Upload[] = rows.map(r => ({ folderId: r.folderId!, status: r.review?.status ?? null }))
  return buildSubmissionProgress(folders, subfolders, uploads)
}
