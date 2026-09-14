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

  const [teacher, conferences, categoryLinks, unpaidBookings] = await Promise.all([
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
    // Students with at least one confirmed-but-unpaid service booking — drives the
    // "payment due" badge on calendar events (see PaymentReminderModal). This is
    // ONE of several sources of a billable lesson — see isBillableEvent for the rest
    // (manually scheduled / repeated calendar events, and video calls tied to a service).
    prisma.serviceBooking.findMany({
      where: { status: 'CONFIRMED', paidAt: null, service: { teacherId } },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
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

  // Union of every "unpaid billable lesson" source: confirmed ServiceBookings,
  // plus any billable event in the merged calendar (manually created, repeated,
  // or a video call tied to a service) that isn't marked paid yet.
  const pendingFromBookings = unpaidBookings.map(b => b.studentId)
  const pendingFromEvents = [...storedEvents, ...conferenceEvents]
    .filter((e): e is BillableCalendarEvent => isBillableEvent(e as BillableCalendarEvent) && !(e as BillableCalendarEvent).paid)
    .map(e => e.studentId!)

  return NextResponse.json({
    events: [...storedEvents, ...conferenceEvents],
    tasks: calendarData?.tasks ?? [],
    categoryIds: categoryLinks.map(l => l.categoryId),
    studentsWithPendingPayment: [...new Set([...pendingFromBookings, ...pendingFromEvents])],
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
