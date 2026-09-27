import { NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { activeGrantWhere, getFilesSessionUser } from '@/shared/lib/tutorFiles/access'

// GET /api/tutor-files/deadlines — teacher's own submission-dropbox folders
// (TutorFolder.submissionDeadline set), each with the per-student breakdown
// the calendar's status popup needs: who has an active grant, whether their
// personal "учебная" subfolder already holds a submission, and when.
// Mirrors the calendar/homework pattern (GET /api/homework — teacher-only,
// GET /api/homework/mine — student's own view of the same thing).
export async function GET() {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dropboxes = await prisma.tutorFolder.findMany({
      where: { teacherId: user.id, submissionDeadline: { not: null } },
      select: { id: true, name: true, submissionDeadline: true },
    })
    if (dropboxes.length === 0) return NextResponse.json({ deadlines: [] })

    const dropboxIds = dropboxes.map(d => d.id)
    const [grants, subfolders] = await Promise.all([
      prisma.tutorFolderGrant.findMany({
        where: { folderId: { in: dropboxIds }, ...activeGrantWhere() },
        select: { folderId: true, student: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.tutorFolder.findMany({
        where: { parentId: { in: dropboxIds }, restrictedToStudentId: { not: null } },
        select: { id: true, parentId: true, restrictedToStudentId: true },
      }),
    ])

    const subfolderIds = subfolders.map(s => s.id)
    const submissions = subfolderIds.length
      ? await prisma.tutorFile.findMany({
          where: { folderId: { in: subfolderIds }, uploadedByRole: 'STUDENT' },
          select: { folderId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : []
    // First submission per subfolder — later re-submissions don't move the date the tutor sees.
    const firstSubmissionAt = new Map<string, Date>()
    // folderId is guaranteed non-null here too (queried `folderId: { in: subfolderIds }`).
    for (const s of submissions) if (!firstSubmissionAt.has(s.folderId!)) firstSubmissionAt.set(s.folderId!, s.createdAt)

    // Both are guaranteed non-null by the query above (parentId in dropboxIds, restrictedToStudentId not null).
    const subfolderFor = new Map(subfolders.map(s => [`${s.parentId!}:${s.restrictedToStudentId!}`, s.id]))
    const grantsByDropbox = new Map<string, typeof grants>()
    for (const g of grants) grantsByDropbox.set(g.folderId, [...(grantsByDropbox.get(g.folderId) ?? []), g])

    const deadlines = dropboxes
      .map(d => {
        const students = (grantsByDropbox.get(d.id) ?? []).map(g => {
          const subfolderId = subfolderFor.get(`${d.id}:${g.student.id}`)
          const submittedAt = subfolderId ? firstSubmissionAt.get(subfolderId) : undefined
          return {
            id: g.student.id,
            name: g.student.name,
            avatarUrl: g.student.avatarUrl,
            submitted: !!submittedAt,
            submittedAt: submittedAt ? submittedAt.toISOString() : null,
            late: !!submittedAt && submittedAt > d.submissionDeadline!,
          }
        })
        return { folderId: d.id, folderName: d.name, deadline: d.submissionDeadline!.toISOString(), students }
      })
      // A dropbox nobody currently has access to has nothing to show on the calendar.
      .filter(d => d.students.length > 0)

    return NextResponse.json({ deadlines })
  } catch (e) {
    console.error('[GET /api/tutor-files/deadlines]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
