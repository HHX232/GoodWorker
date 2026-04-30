// ─── /api/post/[id]/rating/route.ts ─────────────────────────────────────────

import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../../../auth'

interface RouteParams {
  params: Promise<{id: string}>
}

interface RatingData {
  averageStars: number
  totalRatings: number
  userRating: number | null
}

async function getRatingData(postId: string, userId?: string): Promise<RatingData> {
  const [agg, userRating] = await Promise.all([
    prisma.postRating.aggregate({
      where: {postId},
      _avg: {stars: true},
      _count: true
    }),
    userId
      ? prisma.postRating.findUnique({
          where: {postId_authorId: {postId, authorId: userId}}
        })
      : null
  ])

  return {
    averageStars: Math.round((agg._avg.stars ?? 0) * 10) / 10,
    totalRatings: agg._count,
    userRating: userRating?.stars ?? null
  }
}

export async function GET(req: NextRequest, {params}: RouteParams) {
  try {
    const {id: postId} = await params
    const session = await auth()
    const data = await getRatingData(postId, session?.user?.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/post/:id/rating]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}

export async function POST(req: NextRequest, {params}: RouteParams) {
  try {
    const {id: postId} = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({error: 'Unauthorized'}, {status: 401})

    const body: unknown = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({error: 'Invalid body'}, {status: 400})
    }

    const {stars} = body as {stars?: unknown}

    if (!Number.isInteger(stars) || (stars as number) < 1 || (stars as number) > 5) {
      return NextResponse.json({error: 'stars must be an integer between 1 and 5'}, {status: 400})
    }

    const post = await prisma.post.findUnique({where: {id: postId}, select: {id: true}})
    if (!post) return NextResponse.json({error: 'Post not found'}, {status: 404})

    await prisma.postRating.upsert({
      where: {postId_authorId: {postId, authorId: session.user.id}},
      create: {
        postId,
        authorId: session.user.id,
        authorRole: session.user.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
        stars: stars as number
      },
      update: {stars: stars as number}
    })

    const data = await getRatingData(postId, session.user.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[POST /api/post/:id/rating]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
