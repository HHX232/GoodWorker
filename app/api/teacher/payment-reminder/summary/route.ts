import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

// GET /api/teacher/payment-reminder/summary?studentId=xxx
// Billing ledger = confirmed ServiceBookings (the only place price/discount already
// live, via finalPrice) for this student across this teacher's services.
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

    const [setting, bookings] = await Promise.all([
      prisma.paymentReminderSetting.findUnique({
        where: { teacherId_studentId: { teacherId, studentId } },
      }),
      prisma.serviceBooking.findMany({
        where: {
          studentId,
          status: 'CONFIRMED',
          service: { teacherId },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          finalPrice: true,
          confirmedDate: true,
          confirmedTime: true,
          desiredDate: true,
          paidAt: true,
          service: { select: { title: true, currency: true } },
        },
      }),
    ])

    const items = bookings.map(b => ({
      id: b.id,
      serviceTitle: b.service.title,
      price: b.finalPrice,
      currency: b.service.currency,
      date: b.confirmedDate ?? b.desiredDate,
      time: b.confirmedTime,
      paid: !!b.paidAt,
    }))

    const totalOwed = items.filter(i => !i.paid).reduce((s, i) => s + i.price, 0)
    const unpaidCount = items.filter(i => !i.paid).length

    return NextResponse.json({
      everyNLessons: setting?.everyNLessons ?? null,
      items,
      totalOwed,
      unpaidCount,
    })
  } catch (e) {
    console.error('[GET /api/teacher/payment-reminder/summary]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/teacher/payment-reminder/summary — toggle a booking's paid status
// body: { bookingId: string, paid: boolean }
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

    const booking = await prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, service: { select: { teacherId: true } } },
    })
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (booking.service.teacherId !== session.user.id) {
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
