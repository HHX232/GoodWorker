import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    const [avgResult, userRating] = await Promise.all([
      prisma.roadmapRating.aggregate({
        where: { roadmapId },
        _avg: { stars: true },
        _count: true,
      }),
      session?.user?.id
        ? prisma.roadmapRating.findUnique({
            where: { roadmapId_authorId: { roadmapId, authorId: session.user.id } },
          })
        : null,
    ])

    return NextResponse.json({
      avgRating: avgResult._avg.stars ?? 0,
      totalRatings: avgResult._count,
      userRating: userRating?.stars ?? null,
    })
  } catch (error) {
    console.error('[GET /api/roadmap/:id/rating]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stars } = await req.json()
    if (typeof stars !== 'number' || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'stars must be 1–5' }, { status: 400 })
    }

    const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true } })
    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rating = await prisma.roadmapRating.upsert({
      where: { roadmapId_authorId: { roadmapId, authorId: session.user.id } },
      create: {
        roadmapId,
        authorId: session.user.id,
        authorRole: session.user.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
        stars,
      },
      update: { stars },
    })

    const avgResult = await prisma.roadmapRating.aggregate({
      where: { roadmapId },
      _avg: { stars: true },
      _count: true,
    })

    return NextResponse.json({
      userRating: rating.stars,
      avgRating: avgResult._avg.stars ?? 0,
      totalRatings: avgResult._count,
    })
  } catch (error) {
    console.error('[POST /api/roadmap/:id/rating]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
