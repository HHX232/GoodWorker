import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const comment = await prisma.roadmapComment.findFirst({
      where: { roadmapId, authorId: session.user.id },
    })

    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const author =
      comment.authorRole === 'TEACHER'
        ? await prisma.teacher.findUnique({ where: { id: comment.authorId }, select: { id: true, name: true, avatarUrl: true } })
        : await prisma.student.findUnique({ where: { id: comment.authorId }, select: { id: true, name: true, avatarUrl: true } })

    return NextResponse.json({ ...comment, author })
  } catch (error) {
    console.error('[GET /api/roadmap/:id/comments/my]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
