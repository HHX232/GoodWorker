import type { TutorFile, TutorFolder } from '@prisma/client'
import type { FilesPerson, LibraryFile, LibraryFolder, TreeNode } from '@/shared/types/TutorFiles/tutorFiles.types'

// Row → client-shape mappers shared by GET /library and GET /search, so a
// search hit renders with the same card data (counts, grant avatars) as the
// same item in the browse view.

export type GrantRow = { student: FilesPerson }
export const grantStudentSelect = { student: { select: { id: true, name: true, avatarUrl: true } } }

export function toFolder(f: TutorFolder, itemCount: number, grants: GrantRow[] = []): LibraryFolder {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    allowStudentUpload: f.allowStudentUpload,
    restrictedToStudentId: f.restrictedToStudentId,
    cover: f.cover,
    itemCount,
    sharedWith: grants.map(g => g.student),
    updatedAt: f.updatedAt.toISOString(),
  }
}

export function toFile(f: TutorFile, grants: GrantRow[] = []): LibraryFile {
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
    sharedWith: grants.map(g => g.student),
  }
}

export function toTreeNode(f: TutorFolder, parentVisible: boolean): TreeNode {
  return { id: f.id, name: f.name, parentId: parentVisible ? f.parentId : null, teacherId: f.teacherId, restrictedToStudentId: f.restrictedToStudentId, cover: f.cover }
}

/** Student view: direct subfolders + files of a folder, counting only what the student can see. */
export function studentItemCounter(visibleFolders: TutorFolder[], visibleFiles: TutorFile[]): (folderId: string) => number {
  const visibleIds = new Set(visibleFolders.map(f => f.id))
  const counts = new Map<string, number>()
  for (const f of visibleFolders) if (f.parentId && visibleIds.has(f.parentId)) counts.set(f.parentId, (counts.get(f.parentId) ?? 0) + 1)
  for (const f of visibleFiles) if (f.folderId) counts.set(f.folderId, (counts.get(f.folderId) ?? 0) + 1)
  return id => counts.get(id) ?? 0
}
