import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const [comments, total] = await Promise.all([
      prisma.roadmapComment.findMany({
        where: { roadmapId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.roadmapComment.count({ where: { roadmapId } }),
    ])

    const authorIds = comments.map((c) => c.authorId)

    const [teacherMap, studentMap, ratingMap] = await Promise.all([
      prisma.teacher
        .findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, avatarUrl: true } })
        .then((rows) => new Map(rows.map((r) => [r.id, r]))),
      prisma.student
        .findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, avatarUrl: true } })
        .then((rows) => new Map(rows.map((r) => [r.id, r]))),
      prisma.roadmapRating
        .findMany({ where: { roadmapId, authorId: { in: authorIds } }, select: { authorId: true, stars: true } })
        .then((rows) => new Map(rows.map((r) => [r.authorId, r.stars]))),
    ])

    const enriched = comments.map((c) => {
      const author = c.authorRole === 'TEACHER' ? teacherMap.get(c.authorId) : studentMap.get(c.authorId)
      return { ...c, author: author ?? null, userStars: ratingMap.get(c.authorId) ?? null }
    })

    return NextResponse.json({
      comments: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[GET /api/roadmap/:id/comments]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId }, select: { id: true } })
    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { text, imageUrls = [] } = await req.json()
    if (!text?.trim() && imageUrls.length === 0) {
      return NextResponse.json({ error: 'Text or image required' }, { status: 400 })
    }

    const existing = await prisma.roadmapComment.findFirst({
      where: { roadmapId, authorId: session.user.id },
    })

    const data = {
      text: text?.trim() ?? '',
      imageUrls: imageUrls as string[],
    }

    const comment = existing
      ? await prisma.roadmapComment.update({
          where: { id: existing.id },
          data: { ...data, editedAt: new Date() },
        })
      : await prisma.roadmapComment.create({
          data: {
            roadmapId,
            authorId: session.user.id,
            authorRole: session.user.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
            ...data,
          },
        })

    return NextResponse.json(comment, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('[POST /api/roadmap/:id/comments]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
