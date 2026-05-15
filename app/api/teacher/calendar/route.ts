import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

async function resolveTeacherId(req: NextRequest, sessionId: string, sessionRole: string): Promise<string | null> {
  const tid = req.nextUrl.searchParams.get('teacherId') ?? sessionId
  if (sessionRole !== 'ADMIN' && tid !== sessionId) return null
  return tid
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }
  if (role !== 'TEACHER' && role !== 'ADMIN') return NextResponse.json({ events: [] })

  const teacherId = await resolveTeacherId(req, id, role)
  if (!teacherId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { calendar: true },
  })

  const calendarData = teacher?.calendar as { events?: unknown[] } | null
  return NextResponse.json({ events: calendarData?.events ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }
  if (role !== 'TEACHER' && role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const teacherId = await resolveTeacherId(req, id, role)
  if (!teacherId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { events } = await req.json()

  await prisma.teacher.update({
    where: { id: teacherId },
    data: { calendar: { events } },
  })

  return NextResponse.json({ ok: true })
}
