import { prisma } from '@/shared/prisma/prisma'
import type { TutorFolder } from '@prisma/client'
import type { LibraryResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { hasStorageAccess } from './access'
import { grantStudentSelect, loadOpens, people, submissionDeadlineFor, toFile, toFolder, toTreeNode } from './readModel'
import { getTeacherStorageLimits } from './storage'
import { loadSubmissionProgress } from './submissionProgress'

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
    hasStorageAccess(teacherId),
    getTeacherStorageLimits(teacherId),
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

  const [opened, progress, nested] = await Promise.all([
    loadOpens(folders.map(f => f.id), files.map(f => f.id)),
    loadSubmissionProgress(folders),
    loadNestedAccess(folders, allFolders),
  ])
  const deadline = submissionDeadlineFor(current ?? null, byId)
  return {
    role: 'TEACHER',
    folder: current ? { id: current.id, name: current.name, allowStudentUpload: current.allowStudentUpload, restrictedToStudentId: current.restrictedToStudentId, depth: current.ancestorIds.length + 1, deadline: deadline?.toISOString() ?? null } : null,
    breadcrumbs: (current?.ancestorIds ?? []).map(id => byId.get(id)).filter((f): f is TutorFolder => !!f).map(f => ({ id: f.id, name: f.name })),
    groups: [{
      teacher: null,
      folders: folders.map(f => ({ ...toFolder(f, f._count.children + f._count.files, f.grants, opened, progress.get(f.id) ?? null), nestedWith: nested.get(f.id) ?? [] })),
      files: files.map(f => toFile(f, f.grants, opened, deadline)),
    }],
    tree: allFolders.map(f => toTreeNode(f, true)),
    teachers: [],
    canUpload: isVip,
    isVip,
    quotaBytes: limits.quotaBytes,
  }
}

/**
 * Per listed folder: students who can open something inside it (a subfolder or a
 * file) but hold no direct grant on the folder itself — so a container like
 * "Владик" still shows who it concerns when access was given only on "ДЗ" within.
 */
async function loadNestedAccess(listed: { id: string; grants: { studentId: string }[] }[], all: TutorFolder[]) {
  const out = new Map<string, ReturnType<typeof people>>()
  const inside = new Map(listed.map(f => [f.id, all.filter(g => g.ancestorIds.includes(f.id)).map(g => g.id)]))
  const folderIds = [...new Set([...inside.values()].flat())]
  if (folderIds.length === 0) return out
  const [folderGrants, fileGrants] = await Promise.all([
    prisma.tutorFolderGrant.findMany({ where: { folderId: { in: folderIds } }, include: grantStudentSelect, orderBy: { grantedAt: 'asc' } }),
    prisma.tutorFileGrant.findMany({ where: { file: { folderId: { in: folderIds } } }, include: { ...grantStudentSelect, file: { select: { folderId: true } } }, orderBy: { grantedAt: 'asc' } }),
  ])
  for (const f of listed) {
    const ids = new Set(inside.get(f.id))
    const seen = new Set(f.grants.map(g => g.studentId))
    const rows = [...folderGrants.filter(g => ids.has(g.folderId)), ...fileGrants.filter(g => g.file.folderId && ids.has(g.file.folderId))]
    const unique = rows.filter(g => !seen.has(g.studentId) && !!seen.add(g.studentId))
    if (unique.length) out.set(f.id, people(f.id, unique, () => undefined))
  }
  return out
}
