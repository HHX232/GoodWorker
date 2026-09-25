import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import type { TutorFolder } from '@prisma/client'
import { canStudentSee, getFilesSessionUser, isTeacherVipActive, loadStudentVisibility } from '@/shared/lib/tutorFiles/access'
import type { LibraryGroup, LibraryResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { grantStudentSelect, studentItemCounter, toFile, toFolder, toTreeNode } from '@/shared/lib/tutorFiles/readModel'

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
          include: { _count: { select: { children: true, files: true } }, grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } },
          orderBy: { name: 'asc' },
        }),
        prisma.tutorFile.findMany({
          where: { teacherId: user.id, folderId },
          include: { grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } },
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
        teachers: [],
        canUpload: isVip,
        isVip,
      }
      return NextResponse.json(body)
    }

    // STUDENT
    const { grantedIds, folders: visibleFolders, files: visibleFiles } = await loadStudentVisibility(user.id)
    const visibleById = new Map(visibleFolders.map(f => [f.id, f]))
    const countOf = studentItemCounter(visibleFolders, visibleFiles)

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
      const body: LibraryResponse = { role: 'STUDENT', folder: null, breadcrumbs: [], groups, tree, teachers, canUpload: false, isVip: false }
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
      teachers,
      canUpload: current.restrictedToStudentId === user.id,
      isVip: false,
    }
    return NextResponse.json(body)
  } catch (e) {
    console.error('[GET /api/tutor-files/library]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
