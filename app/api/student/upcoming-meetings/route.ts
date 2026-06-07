import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0] // YYYY-MM-DD

    const [conferences, confirmedBookings] = await Promise.all([
      prisma.conference.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: now },
          participants: { some: { studentId: session.user.id } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          roomName: true,
          teacher: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),

      // Confirmed service bookings with a future date
      prisma.serviceBooking.findMany({
        where: {
          studentId: session.user.id,
          status: 'CONFIRMED',
          OR: [
            { confirmedDate: { gte: todayStr } },
            { desiredDate: { gte: todayStr } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          desiredDate: true,
          desiredTime: true,
          confirmedDate: true,
          confirmedTime: true,
          service: {
            select: {
              id: true,
              title: true,
              duration: true,
              teacher: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      }),
    ])

    // Normalise bookings into the same shape as conferences
    const bookingMeetings = confirmedBookings.map((b) => {
      const date = b.confirmedDate ?? b.desiredDate
      const time = b.confirmedTime ?? b.desiredTime
      const scheduledAt = date
        ? time
          ? new Date(`${date}T${time}:00`)
          : new Date(`${date}T00:00:00`)
        : null
      return {
        id: `booking-${b.id}`,
        bookingId: b.id,
        title: b.service.title,
        scheduledAt,
        roomName: null,
        teacher: b.service.teacher,
        type: 'booking' as const,
        duration: b.service.duration,
      }
    })

    const conferenceMeetings = conferences.map((c) => ({
      ...c,
      type: 'conference' as const,
    }))

    const all = [...conferenceMeetings, ...bookingMeetings]
      .sort((a, b) => {
        if (!a.scheduledAt) return 1
        if (!b.scheduledAt) return -1
        return a.scheduledAt.getTime() - b.scheduledAt.getTime()
      })
      .slice(0, 10)

    return NextResponse.json({ meetings: all, conferences })
  } catch (error) {
    console.error('[GET /api/student/upcoming-meetings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
