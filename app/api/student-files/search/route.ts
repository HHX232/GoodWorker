import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'
import { lectureSubjects, sameSubject } from '@/shared/lib/lecture/subjects'
import type { Prisma } from '@prisma/client'

// GET /api/student-files/search?q=&subject= — the student's whole drive by
// name, optionally narrowed to one subject: files of lectures on it plus
// everything inside folders named after it («Конспекты лекций/Физика»).
export async function GET(req: NextRequest) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120)
    const subject = (req.nextUrl.searchParams.get('subject') ?? '').trim().slice(0, 80)
    if (!q && !subject) return NextResponse.json({ folders: [], files: [] })

    const byName = q ? { name: { contains: q, mode: 'insensitive' as const } } : {}
    let folderWhere: Prisma.StudentFolderWhereInput = { studentId, ...byName }
    let fileWhere: Prisma.StudentFileWhereInput = { studentId, ...byName }
    if (subject) {
      const [lectures, subjectFolders] = await Promise.all([
        lectureSubjects(studentId, 'STUDENT'),
        prisma.studentFolder.findMany({ where: { studentId, name: { equals: subject, mode: 'insensitive' } }, select: { id: true } }),
      ])
      const lectureIds = lectures.filter(l => sameSubject(l.subject, subject)).map(l => l.id)
      const rootIds = subjectFolders.map(f => f.id)
      const inside: Prisma.StudentFolderWhereInput = { OR: [{ id: { in: rootIds } }, { ancestorIds: { hasSome: rootIds } }] }
      const insideIds = rootIds.length ? (await prisma.studentFolder.findMany({ where: { studentId, ...inside }, select: { id: true } })).map(f => f.id) : []
      // Without a query the subject's own folders are the entry points; with one, anything matching inside them.
      folderWhere = q ? { ...folderWhere, id: { in: insideIds } } : { studentId, id: { in: rootIds } }
      fileWhere = { ...fileWhere, OR: [{ lectureNoteId: { in: lectureIds } }, { folderId: { in: insideIds } }] }
    }

    const [folders, files] = await Promise.all([
      prisma.studentFolder.findMany({ where: folderWhere, orderBy: { name: 'asc' }, take: 100 }),
      prisma.studentFile.findMany({ where: fileWhere, orderBy: { updatedAt: 'desc' }, take: 200 }),
    ])
    const ids = folders.map(f => f.id)
    const [subCounts, fileCounts] = ids.length
      ? await Promise.all([
          prisma.studentFolder.groupBy({ by: ['parentId'], where: { parentId: { in: ids } }, _count: { _all: true } }),
          prisma.studentFile.groupBy({ by: ['folderId'], where: { folderId: { in: ids } }, _count: { _all: true } }),
        ])
      : [[], []]
    const itemCount = new Map<string, number>()
    for (const c of subCounts) if (c.parentId) itemCount.set(c.parentId, (itemCount.get(c.parentId) ?? 0) + c._count._all)
    for (const c of fileCounts) if (c.folderId) itemCount.set(c.folderId, (itemCount.get(c.folderId) ?? 0) + c._count._all)

    return NextResponse.json({
      folders: folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId, createdAt: f.createdAt, itemCount: itemCount.get(f.id) ?? 0 })),
      files: files.map(f => ({
        id: f.id, name: f.name, sizeBytes: f.sizeBytes, mimeType: f.mimeType, url: f.url, folderId: f.folderId,
        lectureNoteId: f.lectureNoteId, createdAt: f.createdAt, updatedAt: f.updatedAt,
      })),
    })
  } catch (e) {
    console.error('[GET /api/student-files/search]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
