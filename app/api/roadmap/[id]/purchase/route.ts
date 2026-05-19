import { prisma } from '@/shared/prisma/prisma'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [roadmap, buyer] = await Promise.all([
      prisma.roadmap.findUnique({
        where: { id: roadmapId },
        select: { teacherId: true, nodeAccessType: true, price: true, title: true },
      }),
      session.user.role === 'STUDENT'
        ? prisma.student.findUnique({ where: { id: session.user.id }, select: { name: true, avatarUrl: true } })
        : null,
    ])

    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (roadmap.nodeAccessType !== 'PURCHASE') {
      return NextResponse.json({ error: 'This roadmap does not require purchase' }, { status: 400 })
    }
    if ((session.user.role === 'TEACHER' || session.user.role === 'ADMIN') && roadmap.teacherId === session.user.id) {
      return NextResponse.json({ error: 'Owner already has access' }, { status: 400 })
    }

    const access = await prisma.roadmapAccess.upsert({
      where: { roadmapId_studentId: { roadmapId, studentId: session.user.id } },
      create: { roadmapId, studentId: session.user.id, grantedBy: 'PURCHASE' },
      update: { grantedBy: 'PURCHASE' },
    })

    const studentName = buyer?.name ?? 'Ученик'
    await createNotification({
      type: NOTIFICATION_TYPES.ROADMAP_PURCHASE,
      title: 'Новая покупка',
      body: `${studentName} приобрёл роадмап «${roadmap.title ?? 'Без названия'}»`,
      payload: {
        actorId: session.user.id,
        actorName: studentName,
        actorRole: 'STUDENT',
        roadmapId,
        roadmapTitle: roadmap.title ?? '',
        amount: roadmap.price ?? 0,
      },
      teacherId: roadmap.teacherId,
    })

    return NextResponse.json({ success: true, access })
  } catch (error) {
    console.error('[POST /api/roadmap/:id/purchase]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
