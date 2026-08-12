import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    // Teacher can view their student's homework; student can view their own
    if (session.user.role === 'STUDENT' && session.user.id !== studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const assignments = await prisma.homeworkAssignment.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        homework: {
          select: {
            id: true,
            title: true,
            dueAt: true,
            sendAt: true,
            createdAt: true,
            content: true,
            teacher: { select: { id: true, name: true } },
          },
        },
        blockProgress: { select: { blockIndex: true } },
      },
    })

    const result = assignments.map((a) => {
      const blocks = (a.homework.content as { blocks?: unknown[] })?.blocks ?? []
      return {
        id: a.id,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        createdAt: a.createdAt,
        completedBlocks: a.blockProgress.length,
        totalBlocks: blocks.length,
        homework: {
          id: a.homework.id,
          title: a.homework.title,
          dueAt: a.homework.dueAt,
          sendAt: a.homework.sendAt,
          createdAt: a.homework.createdAt,
          teacher: a.homework.teacher,
        },
      }
    })

    return NextResponse.json({ assignments: result })
  } catch (e) {
    console.error('[GET /api/homework/student]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
