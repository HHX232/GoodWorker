import { prisma } from '@/shared/prisma/prisma'
import { tplBookingConfirmed, tplBookingRescheduled, tplBookingCancelled } from '@/shared/lib/notificationTemplates'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only teachers can respond to bookings' }, { status: 403 })
  }

  const { bookingId } = await params
  const body = await req.json().catch(() => ({}))
  const { action, confirmedDate, confirmedTime } = body as {
    action: 'confirm' | 'reschedule' | 'cancel'
    confirmedDate?: string
    confirmedTime?: string
  }

  if (!['confirm', 'reschedule', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    include: { service: true, student: true },
  })

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  // Teacher must own the service
  if (booking.service.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let newStatus: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED'
  const serviceName = booking.service.title

  const notifTpl = action === 'confirm'
    ? tplBookingConfirmed(serviceName, booking.desiredDate, booking.desiredTime)
    : action === 'reschedule'
      ? tplBookingRescheduled(confirmedDate, confirmedTime)
      : tplBookingCancelled(serviceName)

  if (action === 'cancel') newStatus = 'CANCELLED'

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceBooking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        ...(action === 'reschedule' && {
          confirmedDate: confirmedDate ?? null,
          confirmedTime: confirmedTime ?? null,
        }),
      },
    })

    await tx.notification.create({
      data: {
        type: 'BOOKING_RESPONSE',
        title: notifTpl.title,
        body: notifTpl.body,
        titleTranslations: notifTpl.titleTranslations,
        bodyTranslations: notifTpl.bodyTranslations,
        payload: {
          bookingId,
          serviceId: booking.serviceId,
          serviceName,
          action,
          confirmedDate: confirmedDate ?? null,
          confirmedTime: confirmedTime ?? null,
        },
        studentId: booking.studentId,
      },
    })

    if (action === 'confirm' || action === 'reschedule') {
      // Add/ensure student is in teacher's student list
      await tx.teacherStudent.upsert({
        where: { teacherId_studentId: { teacherId: booking.service.teacherId, studentId: booking.studentId } },
        update: {},
        create: { teacherId: booking.service.teacherId, studentId: booking.studentId },
      })

      // Add calendar event to teacher
      const theDate = action === 'confirm' ? (booking.desiredDate ?? null) : (confirmedDate ?? null)
      const theTime = action === 'confirm' ? (booking.desiredTime ?? null) : (confirmedTime ?? null)

      const teacher = await tx.teacher.findUnique({ where: { id: booking.service.teacherId }, select: { calendar: true } })
      const calData = teacher?.calendar as { events?: unknown[]; tasks?: unknown[] } | null
      const existingEvents = calData?.events ?? []

      // Calculate endTime if duration is available
      let endTime = theTime
      if (theTime && booking.service.duration) {
        const [hours, minutes] = theTime.split(':').map(Number)
        const totalMinutes = hours * 60 + minutes + booking.service.duration
        const endHours = Math.floor(totalMinutes / 60) % 24
        const endMins = totalMinutes % 60
        endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
      }

      const newEvent = {
        id: `booking-${bookingId}`,
        title: `Урок с ${booking.student.name}`,
        date: theDate,
        startTime: theTime,
        endTime,
        color: 'purple',
        studentName: booking.student.name,
        status: 'scheduled',
        serviceId: booking.serviceId,
        serviceTitle: booking.service.title,
      }

      await tx.teacher.update({
        where: { id: booking.service.teacherId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { calendar: { events: [...existingEvents, newEvent], tasks: calData?.tasks ?? [] } as any },
      })
    }

    return updated
  })

  return NextResponse.json({ booking: updatedBooking })
}
