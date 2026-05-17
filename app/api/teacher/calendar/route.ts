import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

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

  const [teacher, conferences] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { calendar: true } }),
    prisma.conference.findMany({
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
        participants: {
          where: { studentId: { not: null } },
          select: { student: { select: { name: true } } },
          take: 1,
        },
      },
    }),
  ])

  const calendarData = teacher?.calendar as { events?: unknown[]; tasks?: unknown[] } | null
  const storedEvents: unknown[] = calendarData?.events ?? []

  // build a set of conference IDs already present in the stored blob (if teacher added them manually)
  const storedIds = new Set(
    (storedEvents as Array<{ id?: string }>).map(e => e.id).filter(Boolean)
  )

  const conferenceEvents = conferences
    .filter(c => c.scheduledAt && !storedIds.has(c.id))
    .map(c => {
      const start = c.scheduledAt!
      const durationMs = (parseInt(c.description ?? '60', 10) || 60) * 60 * 1000
      const end = new Date(start.getTime() + durationMs)
      const studentName = c.participants[0]?.student?.name ?? undefined
      return {
        id: c.id,
        title: c.title,
        date: toLocalDate(start),
        startTime: toLocalTime(start),
        endTime: toLocalTime(end),
        color: 'purple' as const,
        studentName,
        status: 'scheduled' as const,
      }
    })

  return NextResponse.json({
    events: [...storedEvents, ...conferenceEvents],
    tasks: calendarData?.tasks ?? [],
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
