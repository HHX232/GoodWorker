import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const {postId, testId, score, maxScore, percent} = await req.json()

    if (!postId || !testId) {
      return NextResponse.json({error: 'postId and testId are required'}, {status: 400})
    }

    const attempt = await prisma.postTestAttempt.create({
      data: {
        postId,
        testId,
        studentId: session?.user?.role === 'STUDENT' ? session.user.id : null,
        teacherId: session?.user?.role === 'TEACHER' ? session.user.id : null,
        score: score ?? null,
        maxScore: maxScore ?? null,
        percent: percent ?? null
      }
    })

    return NextResponse.json(attempt, {status: 201})
  } catch (error) {
    console.error('[POST /api/post-test-attempt]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const {searchParams} = req.nextUrl
    const postId = searchParams.get('postId')

    const where = {
      ...(postId ? {postId} : {}),
      ...(session.user.role === 'STUDENT'
        ? {studentId: session.user.id}
        : session.user.role === 'TEACHER'
          ? {teacherId: session.user.id}
          : {})
    }

    const attempts = await prisma.postTestAttempt.findMany({
      where,
      orderBy: {createdAt: 'desc'},
      take: 100
    })

    return NextResponse.json(attempts)
  } catch (error) {
    console.error('[GET /api/post-test-attempt]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
