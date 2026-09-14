import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'
import { eventAmount, isBillableEvent } from '@/shared/helpers/calendar/eventBilling'
import { loadMergedEvents } from '@/shared/server/calendarEvents'

// GET /api/teacher/payment-reminder/summary?studentId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role: string }).role
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const studentId = req.nextUrl.searchParams.get('studentId')
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

    const teacherId = session.user.id
    const link = await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId, studentId } },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [setting, bookings, { merged }] = await Promise.all([
      prisma.paymentReminderSetting.findUnique({
        where: { teacherId_studentId: { teacherId, studentId } },
      }),
      prisma.serviceBooking.findMany({
        where: { studentId, status: 'CONFIRMED', service: { teacherId } },
        select: {
          id: true, finalPrice: true, paidAt: true, confirmedDate: true, confirmedTime: true, desiredDate: true,
          service: { select: { title: true, currency: true } },
        },
      }),
      loadMergedEvents(teacherId),
    ])

    const bookingItems = bookings.map(b => ({
      id: b.id,
      serviceTitle: b.service.title,
      price: b.finalPrice,
      currency: b.service.currency,
      date: b.confirmedDate ?? b.desiredDate,
      time: b.confirmedTime,
      paid: !!b.paidAt,
    }))

    const eventItems = merged
      .filter(e => e.studentId === studentId && isBillableEvent(e))
      .map(e => ({
        id: `cal:${e.id}`,
        serviceTitle: e.serviceTitle ?? '',
        price: eventAmount(e) ?? 0,
        currency: e.serviceCurrency ?? 'BYN',
        date: e.date,
        time: e.startTime,
        paid: !!e.paid,
      }))

    const items = [...bookingItems, ...eventItems].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    const unpaid = items.filter(i => !i.paid)
    const unpaidCount = unpaid.length

    // Group by currency instead of summing them together — a student can in
    // principle owe for services priced in different currencies.
    const totalsByCurrency = new Map<string, number>()
    for (const i of unpaid) totalsByCurrency.set(i.currency, (totalsByCurrency.get(i.currency) ?? 0) + i.price)
    const totals = [...totalsByCurrency.entries()].map(([currency, amount]) => ({ currency, amount }))

    return NextResponse.json({
      everyNLessons: setting?.everyNLessons ?? null,
      items,
      totals,
      // Back-compat single total for the common single-currency case.
      totalOwed: totals[0]?.amount ?? 0,
      unpaidCount,
    })
  } catch (e) {
    console.error('[GET /api/teacher/payment-reminder/summary]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/teacher/payment-reminder/summary — toggle a booking's or calendar
// event's paid status. body: { bookingId: string, paid: boolean }
// bookingId is either a raw ServiceBooking id, or "cal:<eventId>" for a lesson
// that lives in the teacher's calendar (manually scheduled/repeated, or a call).
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role: string }).role
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { bookingId, paid } = await req.json()
    if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

    const teacherId = session.user.id

    if (typeof bookingId === 'string' && bookingId.startsWith('cal:')) {
      const eventId = bookingId.slice('cal:'.length)
      const { stored, merged } = await loadMergedEvents(teacherId)

      const target = merged.find(e => e.id === eventId)
      if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const alreadyStored = stored.some(e => e.id === eventId)
      const nextStored = alreadyStored
        ? stored.map(e => (e.id === eventId ? { ...e, paid: !!paid } : e))
        : [...stored, { ...target, paid: !!paid }]

      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { calendar: true } })
      const tasks = (teacher?.calendar as { tasks?: unknown[] } | null)?.tasks ?? []

      await prisma.teacher.update({
        where: { id: teacherId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { calendar: { events: nextStored, tasks } as any },
      })

      return NextResponse.json({ id: bookingId, paid: !!paid })
    }

    const booking = await prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, service: { select: { teacherId: true } } },
    })
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (booking.service.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.serviceBooking.update({
      where: { id: bookingId },
      data: { paidAt: paid ? new Date() : null },
    })

    return NextResponse.json({ id: updated.id, paid: !!updated.paidAt })
  } catch (e) {
    console.error('[PATCH /api/teacher/payment-reminder/summary]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
