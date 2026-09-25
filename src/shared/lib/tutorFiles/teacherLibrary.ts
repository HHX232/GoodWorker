import { prisma } from '@/shared/prisma/prisma'
import type { TutorFolder } from '@prisma/client'
import type { LibraryResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { isTeacherVipActive } from './access'
import { grantStudentSelect, loadOpens, submissionDeadlineFor, toFile, toFolder, toTreeNode } from './readModel'
import { getStorageLimits } from './storage'

export type LibraryError = { status: 403 | 404; error: string }

/**
 * A tutor's own library at `folderId` (root when null): one group with grant
 * avatars + first-open times, the whole folder tree for the sidebar. Shared by
 * the tutor's GET /library and the admin's read-only view of any tutor
 * (GET /api/admin/tutor-files/library) — neither records anything.
 */
export async function buildTeacherLibrary(teacherId: string, folderId: string | null): Promise<LibraryResponse | LibraryError> {
  const [allFolders, isVip, limits] = await Promise.all([
    prisma.tutorFolder.findMany({ where: { teacherId }, orderBy: { name: 'asc' } }),
    isTeacherVipActive(teacherId),
    getStorageLimits(),
  ])
  const byId = new Map(allFolders.map(f => [f.id, f]))
  const current = folderId ? byId.get(folderId) : null
  if (folderId && !current) {
    const exists = await prisma.tutorFolder.findUnique({ where: { id: folderId }, select: { id: true } })
    return exists ? { status: 403, error: 'Forbidden' } : { status: 404, error: 'Not found' }
  }

  const [folders, files] = await Promise.all([
    prisma.tutorFolder.findMany({
      where: { teacherId, parentId: folderId },
      include: { _count: { select: { children: true, files: true } }, grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.tutorFile.findMany({
      where: { teacherId, folderId },
      include: { grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } }, review: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const opened = await loadOpens(folders.map(f => f.id), files.map(f => f.id))
  const deadline = submissionDeadlineFor(current ?? null, byId)
  return {
    role: 'TEACHER',
    folder: current ? { id: current.id, name: current.name, allowStudentUpload: current.allowStudentUpload, restrictedToStudentId: current.restrictedToStudentId, depth: current.ancestorIds.length + 1, deadline: deadline?.toISOString() ?? null } : null,
    breadcrumbs: (current?.ancestorIds ?? []).map(id => byId.get(id)).filter((f): f is TutorFolder => !!f).map(f => ({ id: f.id, name: f.name })),
    groups: [{
      teacher: null,
      folders: folders.map(f => toFolder(f, f._count.children + f._count.files, f.grants, opened)),
      files: files.map(f => toFile(f, f.grants, opened, deadline)),
    }],
    tree: allFolders.map(f => toTreeNode(f, true)),
    teachers: [],
    canUpload: isVip,
    isVip,
    quotaBytes: limits.quotaBytes,
  }
}
