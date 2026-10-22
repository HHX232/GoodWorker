import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { buildPresence, canReadBook } from '@/shared/lib/tutorFiles/books'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/tutor-files/books/[id]/presence — owner only: where each student
// stopped and which pages they read, per page (A5: students never see this).
// → BookPresence { pages: { [page]: { stoppedHere, readBy } } }
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (user.role !== 'TEACHER' || !(await canReadBook(user, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [stops, reads] = await Promise.all([
      prisma.tutorBookProgress.findMany({ where: { fileId: id, ownerRole: 'STUDENT' }, select: { ownerId: true, lastPage: true, updatedAt: true } }),
      prisma.tutorBookRead.findMany({ where: { fileId: id }, select: { studentId: true, page: true, lastReadAt: true } }),
    ])
    const studentIds = [...new Set([...stops.map(s => s.ownerId), ...reads.map(r => r.studentId)])]
    const students = studentIds.length ? await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true, avatarUrl: true } }) : []
    return NextResponse.json(buildPresence(
      stops.map(s => ({ studentId: s.ownerId, lastPage: s.lastPage, updatedAt: s.updatedAt })),
      reads,
      new Map(students.map(s => [s.id, s])),
    ))
  } catch (e) {
    console.error('[GET /api/tutor-files/books/[id]/presence]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
