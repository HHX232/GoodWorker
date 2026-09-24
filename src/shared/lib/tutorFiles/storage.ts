import { prisma } from '@/shared/prisma/prisma'

/** Single source of truth for the storage cap — interfaces.md "Контракт между тикетами: квота". */
export const QUOTA_BYTES = 7 * 1024 ** 3

/**
 * A root folder (no parent) has depth 1 (`ancestorIds.length === 0`). A
 * folder's depth is `ancestorIds.length + 1`. 6 levels means the deepest
 * allowed folder has 5 ancestors.
 */
export const MAX_FOLDER_DEPTH = 6

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
