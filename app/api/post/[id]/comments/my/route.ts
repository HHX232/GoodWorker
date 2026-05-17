import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'
import { localizeComment } from '@/lib/postAI'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: postId } = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const comment = await prisma.postComment.findFirst({
      where: { postId, authorId: session.user.id }
    })

    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const select = { id: true, name: true, avatarUrl: true }
    let author = null
    if (comment.authorRole === 'STUDENT') {
      author = await prisma.student.findUnique({ where: { id: comment.authorId }, select })
    } else if (comment.authorRole === 'TEACHER') {
      author = await prisma.teacher.findUnique({ where: { id: comment.authorId }, select })
    }

    const lang = req.nextUrl.searchParams.get('lang') ?? 'ru'
    return NextResponse.json(localizeComment({ ...comment, author }, lang))
  } catch (error) {
    console.error('[GET /api/post/:id/comments/my]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
