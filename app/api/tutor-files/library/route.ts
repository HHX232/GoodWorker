import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import type { TutorFile, TutorFolder } from '@prisma/client'
import { canStudentSee, getFilesSessionUser, isTeacherVipActive, loadStudentVisibility } from '@/shared/lib/tutorFiles/access'
import type { FilesPerson, LibraryFile, LibraryFolder, LibraryGroup, LibraryResponse, TreeNode } from '@/shared/types/TutorFiles/tutorFiles.types'

type GrantRow = { student: FilesPerson }
const studentSelect = { student: { select: { id: true, name: true, avatarUrl: true } } }

function toFolder(f: TutorFolder, itemCount: number, grants: GrantRow[] = []): LibraryFolder {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    allowStudentUpload: f.allowStudentUpload,
    restrictedToStudentId: f.restrictedToStudentId,
    itemCount,
    sharedWith: grants.map(g => g.student),
    updatedAt: f.updatedAt.toISOString(),
  }
}

function toFile(f: TutorFile, grants: GrantRow[] = []): LibraryFile {
  return {
    id: f.id,
    name: f.name,
    url: f.url,
    sizeBytes: f.sizeBytes,
    mimeType: f.mimeType,
    uploadedByRole: f.uploadedByRole,
    uploadedById: f.uploadedById,
    createdAt: f.createdAt.toISOString(),
    sharedWith: grants.map(g => g.student),
  }
}

function toTreeNode(f: TutorFolder, parentVisible: boolean): TreeNode {
  return { id: f.id, name: f.name, parentId: parentVisible ? f.parentId : null, teacherId: f.teacherId, restrictedToStudentId: f.restrictedToStudentId }
}

// GET /api/tutor-files/library?folderId=... — the browse read model behind
// <FilesShell> for both roles (tickets 05/07). Teacher: their own library,
// one group, with per-item grant avatars. Student: only what canStudentSee()
// allows (via loadStudentVisibility, same loader as search), grouped by
// tutor at the root. Always returns the flat folder `tree` for the sidebar.
export async function GET(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const folderId = req.nextUrl.searchParams.get('folderId') || null

    if (user.role === 'TEACHER') {
      const [allFolders, isVip] = await Promise.all([
        prisma.tutorFolder.findMany({ where: { teacherId: user.id }, orderBy: { name: 'asc' } }),
        isTeacherVipActive(user.id),
      ])
      const byId = new Map(allFolders.map(f => [f.id, f]))
      const current = folderId ? byId.get(folderId) : null
      if (folderId && !current) {
        const exists = await prisma.tutorFolder.findUnique({ where: { id: folderId }, select: { id: true } })
        return NextResponse.json({ error: exists ? 'Forbidden' : 'Not found' }, { status: exists ? 403 : 404 })
      }

      const [folders, files] = await Promise.all([
        prisma.tutorFolder.findMany({
          where: { teacherId: user.id, parentId: folderId },
          include: { _count: { select: { children: true, files: true } }, grants: { include: studentSelect, orderBy: { grantedAt: 'asc' } } },
          orderBy: { name: 'asc' },
        }),
        prisma.tutorFile.findMany({
          where: { teacherId: user.id, folderId },
          include: { grants: { include: studentSelect, orderBy: { grantedAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      const body: LibraryResponse = {
        role: 'TEACHER',
        folder: current ? { id: current.id, name: current.name, allowStudentUpload: current.allowStudentUpload, restrictedToStudentId: current.restrictedToStudentId, depth: current.ancestorIds.length + 1 } : null,
        breadcrumbs: (current?.ancestorIds ?? []).map(id => byId.get(id)).filter((f): f is TutorFolder => !!f).map(f => ({ id: f.id, name: f.name })),
        groups: [{
          teacher: null,
          folders: folders.map(f => toFolder(f, f._count.children + f._count.files, f.grants)),
          files: files.map(f => toFile(f, f.grants)),
        }],
        tree: allFolders.map(f => toTreeNode(f, true)),
        canUpload: isVip,
        isVip,
      }
      return NextResponse.json(body)
    }

    // STUDENT
    const { grantedIds, folders: visibleFolders, files: visibleFiles } = await loadStudentVisibility(user.id)
    const visibleById = new Map(visibleFolders.map(f => [f.id, f]))
    const childFolderCount = new Map<string, number>()
    for (const f of visibleFolders) if (f.parentId && visibleById.has(f.parentId)) childFolderCount.set(f.parentId, (childFolderCount.get(f.parentId) ?? 0) + 1)
    const fileCount = new Map<string, number>()
    for (const f of visibleFiles) if (f.folderId) fileCount.set(f.folderId, (fileCount.get(f.folderId) ?? 0) + 1)
    const countOf = (id: string) => (childFolderCount.get(id) ?? 0) + (fileCount.get(id) ?? 0)

    const teacherIds = [...new Set([...visibleFolders.map(f => f.teacherId), ...visibleFiles.map(f => f.teacherId)])]
    const teachers = await prisma.teacher.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true, avatarUrl: true }, orderBy: { name: 'asc' } })
    const teacherById = new Map(teachers.map(t => [t.id, t]))
    const tree = visibleFolders.map(f => toTreeNode(f, !!f.parentId && visibleById.has(f.parentId)))

    if (!folderId) {
      // Root: the top of each visible branch — a folder/file whose container isn't itself visible.
      const groups: LibraryGroup[] = teachers.map(teacher => ({
        teacher,
        folders: visibleFolders.filter(f => f.teacherId === teacher.id && !(f.parentId && visibleById.has(f.parentId))).map(f => toFolder(f, countOf(f.id))),
        files: visibleFiles.filter(f => f.teacherId === teacher.id && !(f.folderId && visibleById.has(f.folderId))).map(f => toFile(f)),
      }))
      const body: LibraryResponse = { role: 'STUDENT', folder: null, breadcrumbs: [], groups, tree, canUpload: false, isVip: false }
      return NextResponse.json(body)
    }

    const current = visibleById.get(folderId)
    if (!current || !canStudentSee(current, user.id, grantedIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body: LibraryResponse = {
      role: 'STUDENT',
      folder: { id: current.id, name: current.name, allowStudentUpload: current.allowStudentUpload, restrictedToStudentId: current.restrictedToStudentId, depth: current.ancestorIds.length + 1 },
      breadcrumbs: current.ancestorIds.map(id => visibleById.get(id)).filter((f): f is TutorFolder => !!f).map(f => ({ id: f.id, name: f.name })),
      groups: [{
        teacher: teacherById.get(current.teacherId) ?? null,
        folders: visibleFolders.filter(f => f.parentId === current.id).map(f => toFolder(f, countOf(f.id))),
        files: visibleFiles.filter(f => f.folderId === current.id).map(f => toFile(f)),
      }],
      tree,
      canUpload: current.restrictedToStudentId === user.id,
      isVip: false,
    }
    return NextResponse.json(body)
  } catch (e) {
    console.error('[GET /api/tutor-files/library]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
