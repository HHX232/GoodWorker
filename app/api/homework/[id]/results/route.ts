import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: hwId } = await params

    const homework = await prisma.homework.findUnique({
      where: { id: hwId, teacherId: session.user.id },
      include: {
        assignments: {
          include: {
            student: { select: { id: true, name: true, avatarUrl: true } },
            blockProgress: { select: { blockIndex: true, completedAt: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!homework) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalBlocks = (homework.content as any)?.blocks?.length ?? 0

    const results = homework.assignments.map(a => ({
      assignmentId: a.id,
      studentId: a.student.id,
      studentName: a.student.name,
      studentAvatar: a.student.avatarUrl,
      status: a.status,
      completedBlocks: a.blockProgress.length,
      totalBlocks,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      blockProgress: a.blockProgress.map(bp => bp.blockIndex),
      grade: a.grade,
      gradeComment: a.gradeComment,
      gradePhotos: a.gradePhotos,
      reviewedAt: a.reviewedAt,
    }))

    return NextResponse.json({
      homework: { id: homework.id, title: homework.title, totalBlocks },
      results,
    })
  } catch (e) {
    console.error('[GET /api/homework/[id]/results]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
