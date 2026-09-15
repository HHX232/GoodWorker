import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { isBillableEvent, type BillableCalendarEvent } from '@/shared/helpers/calendar/eventBilling'

async function resolveTeacherId(req: NextRequest, sessionId: string, sessionRole: string): Promise<string | null> {
  const tid = req.nextUrl.searchParams.get('teacherId') ?? sessionId
  if (sessionRole !== 'ADMIN' && tid !== sessionId) return null
  return tid
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toLocalTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }
  if (role !== 'TEACHER' && role !== 'ADMIN') return NextResponse.json({ events: [], tasks: [] })

  const teacherId = await resolveTeacherId(req, id, role)
  if (!teacherId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [teacher, conferences, categoryLinks, reminderSettings] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { calendar: true } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.conference.findMany as any)({
      where: {
        teacherId,
        status: 'SCHEDULED',
        scheduledAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        description: true,
        durationMinutes: true,
        serviceId: true,
        service: { select: { title: true, price: true, duration: true, currency: true } },
        participants: {
          where: { studentId: { not: null } },
          select: { student: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    }),
    prisma.teacherCategory.findMany({ where: { teacherId }, select: { categoryId: true } }),
    prisma.paymentReminderSetting.findMany({ where: { teacherId }, select: { studentId: true, everyNLessons: true } }),
  ])

  const calendarData = teacher?.calendar as { events?: unknown[]; tasks?: unknown[] } | null
  const storedEvents: unknown[] = calendarData?.events ?? []

  // build a set of conference IDs already present in the stored blob (if teacher added them manually)
  const storedIds = new Set(
    (storedEvents as Array<{ id?: string }>).map(e => e.id).filter(Boolean)
  )

  type ConferenceRow = {
    id: string; title: string; scheduledAt: Date | null; description: string | null
    durationMinutes?: number | null; serviceId?: string | null
    service?: { title: string; price: number; duration: number; currency: string } | null
    participants: { student: { id: string; name: string } | null }[]
  }

  const conferenceEvents = (conferences as ConferenceRow[])
    .filter(c => c.scheduledAt && !storedIds.has(c.id))
    .map(c => {
      const start = c.scheduledAt!
      const durMins = c.durationMinutes ?? (parseInt(c.description ?? '60', 10) || 60)
      const end = new Date(start.getTime() + durMins * 60 * 1000)
      const student = c.participants[0]?.student ?? null
      return {
        id: c.id,
        title: c.title,
        date: toLocalDate(start),
        startTime: toLocalTime(start),
        endTime: toLocalTime(end),
        color: 'purple' as const,
        studentId: student?.id,
        studentName: student?.name,
        status: 'scheduled' as const,
        durationMinutes: durMins,
        ...(c.serviceId ? {
          serviceId: c.serviceId,
          serviceTitle: c.service?.title,
          servicePrice: c.service?.price,
          serviceCurrency: c.service?.currency,
          serviceDurationMinutes: c.service?.duration,
        } : {}),
      }
    })

  const allEvents = [...storedEvents, ...conferenceEvents] as BillableCalendarEvent[]

  // Payment badge shows only on "checkpoint" lessons — the 1st, 2nd, 3rd... Nth
  // still-unpaid lesson for that student (oldest first), per the teacher's
  // "remind every N lessons" setting — not on every unpaid lesson (a student
  // with 8 unpaid lessons and N=4 gets exactly 2 badges, not 8). Recomputed
  // fresh from "currently still unpaid" each request, so marking one paid
  // shifts the checkpoint to what's now the Nth unpaid lesson.
  const paymentDueEventIds: string[] = []
  for (const setting of reminderSettings) {
    if (setting.everyNLessons <= 0) continue
    const unpaidForStudent = allEvents
      .filter(e => isBillableEvent(e) && e.studentId === setting.studentId && !e.paid)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    for (let i = 0; i < unpaidForStudent.length; i++) {
      if ((i + 1) % setting.everyNLessons === 0) paymentDueEventIds.push(unpaidForStudent[i].id)
    }
  }

  return NextResponse.json({
    events: allEvents,
    tasks: calendarData?.tasks ?? [],
    categoryIds: categoryLinks.map(l => l.categoryId),
    paymentDueEventIds,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }
  if (role !== 'TEACHER' && role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const teacherId = await resolveTeacherId(req, id, role)
  if (!teacherId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { events, tasks } = await req.json()

  await prisma.teacher.update({
    where: { id: teacherId },
    data: { calendar: { events: events ?? [], tasks: tasks ?? [] } },
  })

  return NextResponse.json({ ok: true })
}
