import { prisma } from '@/shared/prisma/prisma'
import { MAX_FOLDER_DEPTH, QUOTA_BYTES } from './constants'

export { MAX_FOLDER_DEPTH, QUOTA_BYTES }

export class FolderDepthExceededError extends Error {
  constructor() {
    super(`Достигнута максимальная вложенность папок (${MAX_FOLDER_DEPTH} уровней)`)
    this.name = 'FolderDepthExceededError'
  }
}

/**
 * Throws when creating a child folder under a parent whose own
 * `ancestorIds` is `parentAncestorIds` would exceed `MAX_FOLDER_DEPTH`. Call
 * with the *parent* folder's `ancestorIds` before creating the child (its
 * own `ancestorIds` would be `[...parentAncestorIds, parentId]`, one level
 * deeper than the parent).
 */
export function assertFolderDepthAllowed(parentAncestorIds: string[]): void {
  const parentDepth = parentAncestorIds.length + 1
  if (parentDepth >= MAX_FOLDER_DEPTH) throw new FolderDepthExceededError()
}

/** `SUM(sizeBytes)` across every file owned by `teacherId` — used against `QUOTA_BYTES`. */
export async function getUsedBytes(teacherId: string): Promise<number> {
  const result = await prisma.tutorFile.aggregate({ where: { teacherId }, _sum: { sizeBytes: true } })
  return result._sum.sizeBytes ?? 0
}

export class RestrictedAncestorError extends Error {
  constructor() {
    super('Нельзя создать подпапку внутри папки, ограниченной для одного ученика')
    this.name = 'RestrictedAncestorError'
  }
}

/**
 * Guards the invariant `canStudentSee()` (tutorFiles/access.ts) relies on:
 * `restrictedToStudentId` only ever sits on a *leaf* "учебная" subfolder,
 * never on a folder that goes on to have children — `canStudentSee` checks
 * only the item's own `restrictedToStudentId`, not its ancestors', so a
 * child created under an already-restricted folder would silently leak to
 * whichever other student holds a grant on that branch.
 *
 * Call with the *parent* folder (the one the new child will be created
 * under) right before `TutorFolder.create` — tickets 02/03's folder-create
 * route/CRUD must call this (not invent their own restriction check):
 * `assertNotUnderRestrictedFolder(parent)` where `parent` is the loaded
 * `TutorFolder` row (or `{id, ancestorIds, restrictedToStudentId}`).
 * Throws `RestrictedAncestorError` if the parent itself, or any of its
 * ancestors (one query over `parent.ancestorIds`), already has
 * `restrictedToStudentId` set.
 */
export async function assertNotUnderRestrictedFolder(parent: { id: string; ancestorIds: string[]; restrictedToStudentId: string | null }): Promise<void> {
  if (parent.restrictedToStudentId !== null) throw new RestrictedAncestorError()
  if (parent.ancestorIds.length === 0) return
  const restrictedAncestor = await prisma.tutorFolder.findFirst({
    where: { id: { in: parent.ancestorIds }, restrictedToStudentId: { not: null } },
    select: { id: true },
  })
  if (restrictedAncestor) throw new RestrictedAncestorError()
}

/**
 * G03: idempotently creates `studentId`'s own restricted "учебная" subfolder
 * under `folder` (plus that student's grant on it). Shared by the grant route
 * (grant on an `allowStudentUpload` folder) and the folder PATCH route
 * (turning `allowStudentUpload` on backfills every existing grantee), so both
 * keep the leaf-only `restrictedToStudentId` invariant the same way. Returns
 * `false` when the subfolder can't be created (depth cap / restricted parent)
 * — the caller's main grant stays valid, only the subfolder is skipped.
 */
export async function ensureStudentSubfolder(
  folder: { id: string; teacherId: string; ancestorIds: string[]; restrictedToStudentId: string | null },
  studentId: string,
): Promise<boolean> {
  const existing = await prisma.tutorFolder.findFirst({
    where: { parentId: folder.id, restrictedToStudentId: studentId },
    select: { id: true },
  })
  if (existing) {
    // Re-grant after a revoke: the subfolder (and the student's past
    // submissions) survived, only its grant was removed — restore it.
    await prisma.tutorFolderGrant.upsert({
      where: { folderId_studentId: { folderId: existing.id, studentId } },
      create: { folderId: existing.id, studentId },
      update: {},
    })
    return true
  }

  try {
    assertFolderDepthAllowed(folder.ancestorIds)
    await assertNotUnderRestrictedFolder(folder)
  } catch (e) {
    if (e instanceof FolderDepthExceededError || e instanceof RestrictedAncestorError) {
      console.error('[ensureStudentSubfolder] skipped', e)
      return false
    }
    throw e
  }

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })
  await prisma.$transaction(async tx => {
    const child = await tx.tutorFolder.create({
      data: {
        teacherId: folder.teacherId,
        parentId: folder.id,
        name: student?.name ?? 'Ученик',
        ancestorIds: [...folder.ancestorIds, folder.id],
        restrictedToStudentId: studentId,
      },
    })
    await tx.tutorFolderGrant.create({ data: { folderId: child.id, studentId } })
  })
  return true
}

type DropboxFolder = { id: string; teacherId: string; ancestorIds: string[]; restrictedToStudentId: string | null }

/**
 * G03 with inherited access: a grant on `folder` gives the student access to
 * every "сдача" folder at or below it, so each of those needs the student's
 * personal subfolder too — otherwise they'd see a submissions folder they
 * can't submit into.
 */
export async function ensureSubfoldersForGrant(folder: DropboxFolder & { allowStudentUpload: boolean }, studentId: string): Promise<void> {
  const dropboxes = await prisma.tutorFolder.findMany({
    where: { ancestorIds: { has: folder.id }, allowStudentUpload: true, restrictedToStudentId: null },
  })
  if (folder.allowStudentUpload) dropboxes.unshift(folder as typeof dropboxes[number])
  for (const dropbox of dropboxes) await ensureStudentSubfolder(dropbox, studentId)
}

/** Every student who can reach `folder` through a grant on it or on one of its ancestors. */
export async function studentsWithAccess(folder: { id: string; ancestorIds: string[] }): Promise<string[]> {
  const grants = await prisma.tutorFolderGrant.findMany({
    where: { folderId: { in: [folder.id, ...folder.ancestorIds] } },
    select: { studentId: true },
  })
  return [...new Set(grants.map(g => g.studentId))]
}

/**
 * After revoking `studentId`'s grant on `folderId`: drop the student's grant
 * on each of their personal subfolders inside that branch whose submissions
 * parent they can no longer reach through any remaining grant (R04i — revoke
 * really closes the branch; the subfolder and its files stay for the teacher,
 * and a later re-grant restores access via ensureStudentSubfolder).
 */
export async function revokeOrphanedSubfolderGrants(folderId: string, studentId: string): Promise<void> {
  const personal = await prisma.tutorFolder.findMany({
    where: { restrictedToStudentId: studentId, OR: [{ parentId: folderId }, { ancestorIds: { has: folderId } }] },
    select: { id: true, ancestorIds: true },
  })
  if (personal.length === 0) return
  const remaining = new Set(
    (await prisma.tutorFolderGrant.findMany({ where: { studentId }, select: { folderId: true } })).map(g => g.folderId)
  )
  const orphaned = personal.filter(p => !p.ancestorIds.some(id => remaining.has(id))).map(p => p.id)
  if (orphaned.length) await prisma.tutorFolderGrant.deleteMany({ where: { studentId, folderId: { in: orphaned } } })
}
