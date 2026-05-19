import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// POST /api/teacher/schedule-meeting
// Body: { studentId, title, scheduledAt }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const teacherId = session.user.id
    const body = await req.json().catch(() => ({}))
    const { studentId, title, scheduledAt, durationMinutes, serviceId } = body as {
      studentId?: string
      title?: string
      scheduledAt?: string
      durationMinutes?: number
      serviceId?: string
    }
    const duration = Math.max(15, Math.min(480, Number(durationMinutes) || 60))

    if (!studentId || !title?.trim() || !scheduledAt) {
      return NextResponse.json({ error: 'studentId, title and scheduledAt are required' }, { status: 400 })
    }

    const link = await prisma.teacherStudent.findFirst({ where: { teacherId, studentId } })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const meetingTime = new Date(scheduledAt)
    if (isNaN(meetingTime.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 })
    }

    // conflict check: ±1 hour around the requested time
    const windowStart = new Date(meetingTime.getTime() - 60 * 60 * 1000)
    const windowEnd = new Date(meetingTime.getTime() + 60 * 60 * 1000)

    const conflict = await prisma.conference.findFirst({
      where: {
        teacherId,
        status: 'SCHEDULED',
        scheduledAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, title: true, scheduledAt: true },
    })

    if (conflict) {
      return NextResponse.json({
        error: 'conflict',
        conflict: {
          id: conflict.id,
          title: conflict.title,
          scheduledAt: conflict.scheduledAt?.toISOString(),
        },
      }, { status: 409 })
    }

    const roomName = `${title.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conference = await (prisma.conference.create as any)({
      data: {
        teacherId,
        title: title.trim(),
        scheduledAt: meetingTime,
        roomName,
        status: 'SCHEDULED',
        durationMinutes: duration,
        description: String(duration),
        ...(serviceId ? { serviceId } : {}),
        participants: {
          create: { studentId, role: 'STUDENT' },
        },
      },
    })

    return NextResponse.json({ id: conference.id, roomName: conference.roomName })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/teacher/schedule-meeting?conferenceId=xxx — cancel a scheduled meeting
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const conferenceId = req.nextUrl.searchParams.get('conferenceId')
    if (!conferenceId) return NextResponse.json({ error: 'conferenceId required' }, { status: 400 })

    const conf = await prisma.conference.findFirst({
      where: { id: conferenceId, teacherId: session.user.id, status: 'SCHEDULED' },
    })
    if (!conf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.conference.update({ where: { id: conferenceId }, data: { status: 'CANCELLED' } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
