import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import type { TutorFolder } from '@prisma/client'
import { canStudentSee, getFilesSessionUser, loadStudentVisibility } from '@/shared/lib/tutorFiles/access'
import { buildTeacherLibrary } from '@/shared/lib/tutorFiles/teacherLibrary'
import type { LibraryGroup, LibraryResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { studentItemCounter, submissionDeadlineFor, toFile, toFolder, toTreeNode } from '@/shared/lib/tutorFiles/readModel'

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
      const body = await buildTeacherLibrary(user.id, folderId)
      if ('status' in body) return NextResponse.json({ error: body.error }, { status: body.status })
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
      const body: LibraryResponse = { role: 'STUDENT', folder: null, breadcrumbs: [], groups, tree, teachers, canUpload: false, isVip: false, quotaBytes: 0 }
      return NextResponse.json(body)
    }

    const current = visibleById.get(folderId)
    if (!current || !canStudentSee(current, user.id, grantedIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // Entering a folder counts as opening it (the tutor's avatar hover).
    await prisma.tutorFolderOpen.createMany({ data: [{ folderId: current.id, studentId: user.id }], skipDuplicates: true })

    // The parent submissions folder may be outside what the student sees directly — load it for its deadline.
    const parent = current.restrictedToStudentId && current.parentId ? await prisma.tutorFolder.findUnique({ where: { id: current.parentId } }) : null
    const deadline = submissionDeadlineFor(current, new Map(parent ? [[parent.id, parent]] : []))
    const body: LibraryResponse = {
      role: 'STUDENT',
      folder: { id: current.id, name: current.name, allowStudentUpload: current.allowStudentUpload, restrictedToStudentId: current.restrictedToStudentId, depth: current.ancestorIds.length + 1, deadline: deadline?.toISOString() ?? null },
      breadcrumbs: current.ancestorIds.map(id => visibleById.get(id)).filter((f): f is TutorFolder => !!f).map(f => ({ id: f.id, name: f.name })),
      groups: [{
        teacher: teacherById.get(current.teacherId) ?? null,
        folders: visibleFolders.filter(f => f.parentId === current.id).map(f => toFolder(f, countOf(f.id))),
        files: visibleFiles.filter(f => f.folderId === current.id).map(f => toFile(f, [], undefined, deadline)),
      }],
      tree,
      teachers,
      canUpload: current.restrictedToStudentId === user.id,
      isVip: false,
      quotaBytes: 0,
    }
    return NextResponse.json(body)
  } catch (e) {
    console.error('[GET /api/tutor-files/library]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
