import { prisma } from '@/shared/prisma/prisma'

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

/**
 * How many lessons are on today's calendar — the same two sources
 * `GET /api/teacher/calendar` merges (Teacher.calendar's stored `events` JSON
 * plus SCHEDULED Conference rows not already in that blob, deduped by id).
 * Kept as its own small query rather than importing the route: the route
 * also loads categories/reminder settings/payment badges this doesn't need.
 */
export async function getTodayLessonsCount(teacherId: string): Promise<number> {
  const today = toLocalDate(new Date())

  const [teacher, conferences] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { calendar: true } }),
    prisma.conference.findMany({
      where: { teacherId, status: 'SCHEDULED', scheduledAt: { not: null } },
      select: { id: true, scheduledAt: true },
    }),
  ])

  const calendarData = teacher?.calendar as { events?: { id?: string; date?: string }[] } | null
  const storedEvents = calendarData?.events ?? []
  const storedIds = new Set(storedEvents.map(e => e?.id).filter(Boolean))

  const storedToday = storedEvents.filter(e => e?.date === today).length
  const conferenceToday = conferences.filter(c => c.scheduledAt && !storedIds.has(c.id) && toLocalDate(c.scheduledAt) === today).length

  return storedToday + conferenceToday
}
