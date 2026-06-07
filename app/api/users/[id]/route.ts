import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await auth()

    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        lastSeenAt: true,
        _count: {
          select: {
            postViews: true,
            roadmapProgress: true,
          },
        },
      },
    })

    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [commentCount, isMyStudent] = await Promise.all([
      prisma.postComment.count({ where: { authorId: id, authorRole: 'STUDENT' } }),
      session?.user?.role === 'TEACHER'
        ? prisma.teacherStudent.findFirst({
            where: { teacherId: session.user.id, studentId: id },
            select: { linkedAt: true },
          })
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      id: student.id,
      name: student.name,
      avatarUrl: student.avatarUrl,
      createdAt: student.createdAt,
      lastSeenAt: student.lastSeenAt,
      stats: {
        postsRead: student._count.postViews,
        roadmapsStarted: student._count.roadmapProgress,
        commentsLeft: commentCount,
      },
      isMyStudent: !!isMyStudent,
      linkedAt: isMyStudent ? (isMyStudent as { linkedAt: Date }).linkedAt : null,
    })
  } catch (error) {
    console.error('[GET /api/users/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
