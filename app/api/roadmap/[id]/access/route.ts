import { prisma } from '@/shared/prisma/prisma'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { tplNewStudent } from '@/shared/lib/notificationTemplates'
import { RoadmapAccessGrant } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/roadmap/[id]/access — проверить, есть ли у текущего пользователя доступ
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ hasAccess: false })
    }

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { teacherId: true, price: true, nodeAccessType: true },
    })

    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Владелец-учитель всегда имеет доступ
    if ((session.user.role === 'TEACHER' || session.user.role === 'ADMIN') && roadmap.teacherId === session.user.id) {
      return NextResponse.json({ hasAccess: true, grantedBy: 'owner' })
    }

    // Для STUDENTS: любой связанный ученик имеет доступ автоматически
    if (roadmap.nodeAccessType === 'STUDENTS') {
      const linked = await prisma.teacherStudent.findUnique({
        where: {
          teacherId_studentId: { teacherId: roadmap.teacherId, studentId: session.user.id },
        },
      })
      if (linked) return NextResponse.json({ hasAccess: true, grantedBy: 'TEACHER' })
    }

    // Для SELECTED и PURCHASE: проверяем запись в RoadmapAccess
    const access = await prisma.roadmapAccess.findUnique({
      where: { roadmapId_studentId: { roadmapId, studentId: session.user.id } },
      select: { grantedBy: true },
    })

    if (access) {
      return NextResponse.json({ hasAccess: true, grantedBy: access.grantedBy })
    }

    return NextResponse.json({ hasAccess: false })
  } catch (error) {
    console.error('[GET /api/roadmap/:id/access]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/roadmap/[id]/access — учитель (владелец) выдаёт доступ студенту
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmapCheck = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { teacherId: true, title: true },
    })

    if (!roadmapCheck) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (roadmapCheck.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { studentId, grantedBy = 'TEACHER' } = body as {
      studentId: string
      grantedBy?: RoadmapAccessGrant
    }

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const [access, student] = await Promise.all([
      prisma.roadmapAccess.upsert({
        where: { roadmapId_studentId: { roadmapId, studentId } },
        create: { roadmapId, studentId, grantedBy },
        update: { grantedBy },
      }),
      prisma.student.findUnique({ where: { id: studentId }, select: { name: true, avatarUrl: true } }),
    ])

    await createNotification({
      type: NOTIFICATION_TYPES.NEW_STUDENT,
      ...tplNewStudent(student?.name ?? 'Ученик', roadmapCheck.title ?? 'Без названия'),
      payload: {
        actorId: studentId,
        actorName: student?.name ?? 'Ученик',
        actorRole: 'STUDENT',
        actorAvatar: student?.avatarUrl ?? null,
        roadmapId,
        roadmapTitle: roadmapCheck.title ?? '',
      },
      teacherId: session.user.id,
    })

    return NextResponse.json(access)
  } catch (error) {
    console.error('[POST /api/roadmap/:id/access]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
