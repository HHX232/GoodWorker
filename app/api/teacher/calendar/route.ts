import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }
  if (role !== 'TEACHER') return NextResponse.json({ events: [] })

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { calendar: true },
  })

  const calendarData = teacher?.calendar as { events?: unknown[] } | null
  return NextResponse.json({ events: calendarData?.events ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }
  if (role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { events } = await req.json()

  await prisma.teacher.update({
    where: { id },
    data: { calendar: { events } },
  })

  return NextResponse.json({ ok: true })
}
