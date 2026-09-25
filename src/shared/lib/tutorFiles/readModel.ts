import type { TutorFile, TutorFileReview, TutorFolder } from '@prisma/client'

/** A TutorFile as queries return it: the big `contentText` is omitted by default (shared/prisma/prisma.ts). */
export type TutorFileRow = Omit<TutorFile, 'contentText'>
import type { FilesPerson, LibraryFile, LibraryFolder, TreeNode } from '@/shared/types/TutorFiles/tutorFiles.types'

// Row → client-shape mappers shared by GET /library and GET /search, so a
// search hit renders with the same card data (counts, grant avatars) as the
// same item in the browse view.

import { prisma } from '@/shared/prisma/prisma'

export type GrantRow = { studentId: string; student: { id: string; name: string; avatarUrl: string | null }; availableFrom?: Date | null; availableUntil?: Date | null }
/** `itemId:studentId` → first open, for the avatar tooltips. */
export type OpenLookup = (itemId: string, studentId: string) => Date | undefined

const noOpens: OpenLookup = () => undefined

/** First-open times for the given items (teacher views — the avatar hover). */
export async function loadOpens(folderIds: string[], fileIds: string[]): Promise<OpenLookup> {
  const [folderOpens, fileOpens] = await Promise.all([
    folderIds.length ? prisma.tutorFolderOpen.findMany({ where: { folderId: { in: folderIds } } }) : [],
    fileIds.length ? prisma.tutorFileOpen.findMany({ where: { fileId: { in: fileIds } } }) : [],
  ])
  const map = new Map<string, Date>()
  for (const o of folderOpens) map.set(`${o.folderId}:${o.studentId}`, o.firstOpenedAt)
  for (const o of fileOpens) map.set(`${o.fileId}:${o.studentId}`, o.firstOpenedAt)
  return (itemId, studentId) => map.get(`${itemId}:${studentId}`)
}

function people(itemId: string, grants: GrantRow[], opened: OpenLookup): FilesPerson[] {
  return grants.map(g => ({
    ...g.student,
    firstOpenedAt: opened(itemId, g.student.id)?.toISOString() ?? null,
    availableFrom: g.availableFrom?.toISOString() ?? null,
    availableUntil: g.availableUntil?.toISOString() ?? null,
  }))
}
export const grantStudentSelect = { student: { select: { id: true, name: true, avatarUrl: true } } }

export function toFolder(f: TutorFolder, itemCount: number, grants: GrantRow[] = [], opened: OpenLookup = noOpens): LibraryFolder {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    allowStudentUpload: f.allowStudentUpload,
    restrictedToStudentId: f.restrictedToStudentId,
    cover: f.cover,
    submissionDeadline: f.submissionDeadline?.toISOString() ?? null,
    itemCount,
    sharedWith: people(f.id, grants, opened),
    updatedAt: f.updatedAt.toISOString(),
  }
}

export function toFile(f: TutorFileRow & { review?: TutorFileReview | null }, grants: GrantRow[] = [], opened: OpenLookup = noOpens, deadline: Date | null = null): LibraryFile {
  return {
    id: f.id,
    name: f.name,
    folderId: f.folderId,
    url: f.url,
    sizeBytes: f.sizeBytes,
    mimeType: f.mimeType,
    uploadedByRole: f.uploadedByRole,
    uploadedById: f.uploadedById,
    createdAt: f.createdAt.toISOString(),
    sharedWith: people(f.id, grants, opened),
    // Idea 2: a student's submission that came in after the folder's deadline.
    late: f.uploadedByRole === 'STUDENT' && !!deadline && f.createdAt > deadline,
    review: f.review
      ? {
          status: f.review.status as 'ACCEPTED' | 'REVISION',
          grade: f.review.grade,
          comment: f.review.comment,
          annotations: Array.isArray(f.review.annotations) ? (f.review.annotations as { page: number; url: string }[]) : [],
          reviewedAt: f.review.reviewedAt.toISOString(),
        }
      : null,
  }
}

export function toTreeNode(f: TutorFolder, parentVisible: boolean): TreeNode {
  return { id: f.id, name: f.name, parentId: parentVisible ? f.parentId : null, teacherId: f.teacherId, restrictedToStudentId: f.restrictedToStudentId, cover: f.cover }
}

/** Student view: direct subfolders + files of a folder, counting only what the student can see. */
export function studentItemCounter(visibleFolders: TutorFolder[], visibleFiles: TutorFileRow[]): (folderId: string) => number {
  const visibleIds = new Set(visibleFolders.map(f => f.id))
  const counts = new Map<string, number>()
  for (const f of visibleFolders) if (f.parentId && visibleIds.has(f.parentId)) counts.set(f.parentId, (counts.get(f.parentId) ?? 0) + 1)
  for (const f of visibleFiles) if (f.folderId) counts.set(f.folderId, (counts.get(f.folderId) ?? 0) + 1)
  return id => counts.get(id) ?? 0
}

/**
 * The deadline that applies inside `folder`: its own (a submissions folder),
 * or its parent's when it's a student's personal subfolder under one.
 */
export function submissionDeadlineFor(folder: TutorFolder | null, byId: Map<string, TutorFolder>): Date | null {
  if (!folder) return null
  if (folder.restrictedToStudentId && folder.parentId) return byId.get(folder.parentId)?.submissionDeadline ?? null
  return folder.submissionDeadline
}
