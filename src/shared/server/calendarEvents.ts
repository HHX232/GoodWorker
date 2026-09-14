import { prisma } from '@/shared/prisma/prisma'
import type { BillableCalendarEvent } from '@/shared/helpers/calendar/eventBilling'

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function toLocalTime(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

export interface CalendarBlob { events?: BillableCalendarEvent[]; tasks?: unknown[] }

// Every "lesson" that shows up in a teacher's calendar comes from one of two
// places: the client-editable JSON blob on Teacher.calendar (manually created,
// edited, or repeated bookings — see CalendarCreateModal/CalendarPage), or a
// Conference row for a video call, merged in read-only until it's edited (at
// which point it gets copied into the stored blob). Anything that needs a
// complete, current view of "all billable lessons" — the payment-due badge,
// the payment-reminder summary modal, the receipts widget — must read both.
export async function loadMergedEvents(teacherId: string): Promise<{ stored: BillableCalendarEvent[]; merged: BillableCalendarEvent[] }> {
  const [teacher, conferences] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { calendar: true } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.conference.findMany as any)({
      where: { teacherId, status: 'SCHEDULED', scheduledAt: { not: null } },
      select: {
        id: true, title: true, scheduledAt: true, description: true, durationMinutes: true, serviceId: true,
        service: { select: { title: true, price: true, duration: true, currency: true } },
        participants: { where: { studentId: { not: null } }, select: { student: { select: { id: true, name: true } } }, take: 1 },
      },
    }),
  ])

  const calendarData = teacher?.calendar as CalendarBlob | null
  const stored = calendarData?.events ?? []
  const storedIds = new Set(stored.map(e => e.id).filter(Boolean))

  type ConferenceRow = {
    id: string; title: string; scheduledAt: Date | null; description: string | null
    durationMinutes?: number | null; serviceId?: string | null
    service?: { title: string; price: number; duration: number; currency: string } | null
    participants: { student: { id: string; name: string } | null }[]
  }

  const conferenceEvents: BillableCalendarEvent[] = (conferences as ConferenceRow[])
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
        studentId: student?.id,
        studentName: student?.name,
        status: 'scheduled',
        durationMinutes: durMins,
        ...(c.serviceId ? {
          serviceId: c.serviceId,
          serviceTitle: c.service?.title,
          servicePrice: c.service?.price,
          serviceCurrency: c.service?.currency,
          serviceDurationMinutes: c.service?.duration,
        } : {}),
      } as BillableCalendarEvent
    })

  return { stored, merged: [...stored, ...conferenceEvents] }
}
