import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: teacherId } = await params
    const reviews = await prisma.teacherReview.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('[GET /api/teacher/:id/reviews]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: teacherId } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text, stars } = await req.json()
    if (typeof stars !== 'number' || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'stars must be 1–5' }, { status: 400 })
    }
    if (!text || typeof text !== 'string' || text.trim().length < 3) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } })
    if (!teacher) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const review = await prisma.teacherReview.upsert({
      where: { teacherId_authorId: { teacherId, authorId: session.user.id } },
      create: {
        teacherId,
        authorId: session.user.id,
        authorRole: session.user.role,
        authorName: session.user.name ?? 'Anonymous',
        text: text.trim(),
        stars,
      },
      update: {
        text: text.trim(),
        stars,
      },
    })

    return NextResponse.json({ review })
  } catch (error) {
    console.error('[POST /api/teacher/:id/reviews]', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 500 })
  }
}
