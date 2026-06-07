import { prisma } from '@/shared/prisma/prisma'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'

// ─── POST /api/complaints ─────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { text, roadmapId, postId, userId: reportedUserId, targetId, targetType } = body

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    if (!roadmapId && !postId && !reportedUserId) {
      return NextResponse.json({ error: 'roadmapId, postId or userId is required' }, { status: 400 })
    }
    if (!targetId && !reportedUserId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
    }

    // Prevent self-report
    if (reportedUserId && reportedUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
    }

    // One complaint per reporter per target
    const duplicate = await prisma.complaint.findFirst({
      where: {
        reporterId: session.user.id,
        ...(postId ? { postId } : {}),
        ...(roadmapId ? { roadmapId } : {}),
        ...(reportedUserId ? { targetId: reportedUserId, targetType: 'USER' } : {}),
      },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json({ error: 'already_reported' }, { status: 409 })
    }

    const resolvedTargetId = reportedUserId ?? targetId
    const resolvedTargetType = reportedUserId ? 'USER' : (targetType ?? (roadmapId ? 'ROADMAP_NODE' : 'POST'))

    const complaint = await prisma.complaint.create({
      data: {
        reporterId: session.user.id,
        reporterRole: session.user.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
        targetType: resolvedTargetType,
        targetId: resolvedTargetId,
        text: text.trim(),
        roadmapId: roadmapId ?? null,
        postId: postId ?? null,
        studentId: reportedUserId ?? null,
        status: 'pending',
      },
    })

    // Fetch reporter name for notification payload
    const reporterName = session.user.role === 'STUDENT'
      ? (await prisma.student.findUnique({ where: { id: session.user.id }, select: { name: true } }))?.name
      : (await prisma.teacher.findUnique({ where: { id: session.user.id }, select: { name: true } }))?.name
    const actorName = reporterName ?? 'Пользователь'

    // Notify the content owner
    if (roadmapId) {
      const roadmap = await prisma.roadmap.findUnique({
        where: { id: roadmapId },
        select: { teacherId: true, title: true },
      })
      if (roadmap) {
        await createNotification({
          type: NOTIFICATION_TYPES.NEW_COMPLAINT,
          title: 'Новая жалоба',
          body: `${actorName} пожаловался на блок роадмапа «${roadmap.title ?? 'Без названия'}»`,
          payload: {
            actorId: session.user.id,
            actorName,
            actorRole: session.user.role,
            complaintId: complaint.id,
            roadmapId,
            roadmapTitle: roadmap.title ?? '',
            textPreview: text.slice(0, 120),
          },
          teacherId: roadmap.teacherId,
        })
      }
    } else if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { teacherId: true, title: true },
      })
      if (post) {
        await createNotification({
          type: NOTIFICATION_TYPES.NEW_COMPLAINT,
          title: 'Новая жалоба',
          body: `${actorName} пожаловался на пост «${post.title ?? 'Без названия'}»`,
          payload: {
            actorId: session.user.id,
            actorName,
            actorRole: session.user.role,
            complaintId: complaint.id,
            postId,
            postTitle: post.title ?? '',
            textPreview: text.slice(0, 120),
          },
          teacherId: post.teacherId,
        })
      }
    }

    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('[POST /api/complaints]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── GET /api/complaints ──────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status') ?? undefined

    const role = session.user.role
    const userId = session.user.id

    let where: Record<string, unknown> = {}

    if (role === 'STUDENT') {
      // Student: complaints they filed
      where = { reporterId: userId }
    } else if (role === 'TEACHER') {
      // Teacher: complaints on their posts and roadmaps
      where = {
        OR: [
          { roadmap: { teacherId: userId } },
          { post: { teacherId: userId } },
        ],
      }
    } else {
      // Admin: all complaints, optionally filtered
      where = {}
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
          post: { select: { id: true, title: true } },
          roadmap: { select: { id: true, title: true } },
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
    console.error('[GET /api/complaints]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
