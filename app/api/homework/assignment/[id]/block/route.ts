import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: assignmentId } = await params
    const { blockIndex, completed } = await req.json()

    if (typeof blockIndex !== 'number') {
      return NextResponse.json({ error: 'blockIndex required' }, { status: 400 })
    }

    const assignment = await prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        homework: { select: { content: true, teacherId: true } },
        blockProgress: { select: { blockIndex: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only the student who owns this assignment can update progress
    if (session.user.role === 'STUDENT' && assignment.studentId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (session.user.role === 'TEACHER' && assignment.homework.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (completed) {
      await prisma.homeworkBlockProgress.upsert({
        where: { assignmentId_blockIndex: { assignmentId, blockIndex } },
        create: { assignmentId, blockIndex },
        update: { completedAt: new Date() },
      })
    } else {
      await prisma.homeworkBlockProgress.deleteMany({
        where: { assignmentId, blockIndex },
      })
    }

    // Recalculate status (exclude MEDIA and AUDIO blocks from count)
    const allBlocks = (assignment.homework.content as { blocks?: { type: string }[] })?.blocks ?? []
    const countableBlocks = allBlocks.filter(b => b.type !== 'MEDIA' && b.type !== 'AUDIO')
    const totalBlocks = countableBlocks.length

    // Count only progress for countable block indices
    const countableIndices = allBlocks
      .map((b, i) => ({ type: b.type, i }))
      .filter(({ type }) => type !== 'MEDIA' && type !== 'AUDIO')
      .map(({ i }) => i)

    const completedCount = await prisma.homeworkBlockProgress.count({
      where: { assignmentId, blockIndex: { in: countableIndices } },
    })

    let newStatus = assignment.status
    if (completedCount === 0) {
      newStatus = 'PENDING'
    } else if (completedCount >= totalBlocks) {
      newStatus = 'SUBMITTED'
    } else {
      newStatus = 'IN_PROGRESS'
    }

    await prisma.homeworkAssignment.update({
      where: { id: assignmentId },
      data: {
        status: newStatus,
        ...(newStatus === 'IN_PROGRESS' && !assignment.startedAt
          ? { startedAt: new Date() }
          : {}),
        ...(newStatus === 'SUBMITTED' && !assignment.submittedAt
          ? { submittedAt: new Date() }
          : {}),
        ...(newStatus !== 'SUBMITTED' ? { submittedAt: null } : {}),
      },
    })

    return NextResponse.json({ status: newStatus, completedBlocks: completedCount, totalBlocks })
  } catch (e) {
    console.error('[PATCH /api/homework/assignment/[id]/block]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
