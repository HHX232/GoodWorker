import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const assignment = await prisma.homeworkAssignment.findUnique({
      where: { id },
      include: {
        homework: {
          include: {
            teacher: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        student: { select: { id: true, name: true, avatarUrl: true } },
        blockProgress: { select: { blockIndex: true, completedAt: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Auth: student can only see their own; teacher can see their homework
    if (
      session.user.role === 'STUDENT' && assignment.studentId !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (
      session.user.role === 'TEACHER' && assignment.homework.teacherId !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ assignment })
  } catch (e) {
    console.error('[GET /api/homework/[id]]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
