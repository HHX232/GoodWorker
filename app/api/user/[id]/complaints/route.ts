import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/user/[id]/complaints
// Admin: all complaints about content belonging to user [id]
// Teacher: complaints about own content only (if [id] === self)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: targetUserId } = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = session.user.role
    const isSelf = session.user.id === targetUserId

    // Only admin can view others' complaints; teachers can only see their own
    if (role !== 'ADMIN' && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (role === 'STUDENT' && isSelf) {
      // Students see complaints they filed (redirect semantics — just use /api/complaints)
      return NextResponse.json({ error: 'Use /api/complaints for your own complaints' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status') ?? undefined

    const where: Record<string, unknown> = {
      OR: [
        { roadmap: { teacherId: targetUserId } },
        { post: { teacherId: targetUserId } },
      ],
    }
    if (status) where.status = status

    const [items, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          text: true,
          reply: true,
          repliedAt: true,
          createdAt: true,
          targetType: true,
          targetId: true,
          roadmapId: true,
          postId: true,
          reporterId: true,
          reporterRole: true,
        },
      }),
      prisma.complaint.count({ where }),
    ])

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[GET /api/user/:id/complaints]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
