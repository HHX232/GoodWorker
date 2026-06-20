import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toLocalTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: studentId, role } = session.user as { id: string; role: string }
  if (role !== 'STUDENT') return NextResponse.json({ events: [], tasks: [] })

  // Conferences where this student is a participant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conferences = await (prisma.conference.findMany as any)({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { not: null },
      participants: { some: { studentId } },
    },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      durationMinutes: true,
      description: true,
      roomName: true,
      teacher: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  // Confirmed service bookings
  const bookings = await prisma.serviceBooking.findMany({
    where: {
      studentId,
      status: 'CONFIRMED',
    },
    select: {
      id: true,
      desiredDate: true,
      desiredTime: true,
      confirmedDate: true,
      confirmedTime: true,
      service: {
        select: {
          id: true,
          title: true,
          duration: true,
          teacher: { select: { id: true, name: true } },
        },
      },
    },
  })

  type ConfRow = {
    id: string; title: string; scheduledAt: Date | null; durationMinutes?: number | null
    description: string | null; roomName: string | null
    teacher: { id: string; name: string }
  }

  const conferenceEvents = (conferences as ConfRow[])
    .filter(c => c.scheduledAt)
    .map(c => {
      const start = c.scheduledAt!
      const durMins = c.durationMinutes ?? 60
      const end = new Date(start.getTime() + durMins * 60 * 1000)
      return {
        id: c.id,
        title: c.title,
        date: toLocalDate(start),
        startTime: toLocalTime(start),
        endTime: toLocalTime(end),
        color: 'purple' as const,
        teacherName: c.teacher.name,
        roomName: c.roomName,
        durationMinutes: durMins,
        status: 'scheduled' as const,
        fromTeacher: true,
      }
    })

  const bookingEvents = bookings.map(b => {
    const date = b.confirmedDate ?? b.desiredDate
    const time = b.confirmedTime ?? b.desiredTime
    const start = date
      ? time
        ? new Date(`${date}T${time}:00`)
        : new Date(`${date}T09:00:00`)
      : null
    if (!start) return null
    const durMins = b.service.duration ?? 60
    const end = new Date(start.getTime() + durMins * 60 * 1000)
    return {
      id: `booking-${b.id}`,
      title: b.service.title,
      date: toLocalDate(start),
      startTime: toLocalTime(start),
      endTime: toLocalTime(end),
      color: 'blue' as const,
      teacherName: b.service.teacher.name,
      durationMinutes: durMins,
      status: 'scheduled' as const,
      fromTeacher: true,
    }
  }).filter(Boolean)

  // Unique teachers from conferences + bookings for the sidebar
  const teacherMap = new Map<string, { id: string; name: string }>()
  for (const c of conferences as ConfRow[]) {
    if (c.teacher?.id) teacherMap.set(c.teacher.id, c.teacher)
  }
  for (const b of bookings) {
    const t = b.service.teacher
    if (t?.id) teacherMap.set(t.id, t)
  }

  const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED']
  const teachers = Array.from(teacherMap.values()).map((t, i) => {
    const initials = t.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    return {
      id: t.id,
      name: t.name,
      initials,
      subject: '',
      avatarColor: COLORS[i % COLORS.length],
      avatarTextColor: '#fff',
    }
  })

  return NextResponse.json({
    events: [...conferenceEvents, ...bookingEvents],
    tasks: [],
    teachers,
  })
}
