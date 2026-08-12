import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: assignmentId } = await params

    const assignment = await prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        studentId: true,
        status: true,
        homework: { select: { teacherId: true } },
        blockProgress: { select: { blockIndex: true } },
      },
    })

    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (session.user.role === 'STUDENT' && assignment.studentId !== session.user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (session.user.role === 'TEACHER' && assignment.homework.teacherId !== session.user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({
      completedIndices: assignment.blockProgress.map((p: { blockIndex: number }) => p.blockIndex),
      status: assignment.status,
    })
  } catch (e) {
    console.error('[GET /api/homework/assignment/[id]/progress]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
