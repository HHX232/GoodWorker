import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// GET /api/teacher/student-detail?studentId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const teacherId = session.user.id
    const studentId = req.nextUrl.searchParams.get('studentId')
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

    // verify this student is linked to the teacher
    const link = await prisma.teacherStudent.findFirst({ where: { teacherId, studentId } })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const todayStr = new Date().toISOString().split('T')[0]

    const [student, errors, meetings, confirmedBookings] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      }),

      prisma.studentError.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          categories: {
            include: {
              category: {
                include: { translations: { where: { langCode: 'ru' } } },
              },
            },
          },
        },
      }),

      prisma.conference.findMany({
        where: {
          teacherId,
          participants: { some: { studentId } },
          status: 'SCHEDULED',
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
        select: { id: true, title: true, scheduledAt: true, roomName: true },
      }),

      prisma.serviceBooking.findMany({
        where: {
          studentId,
          status: 'CONFIRMED',
          service: { teacherId },
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
          service: { select: { id: true, title: true, duration: true } },
        },
      }),
    ])

    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const conferenceMeetings = meetings.map(m => ({
      id: m.id,
      title: m.title,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
      roomName: m.roomName,
      type: 'conference' as const,
    }))

    const bookingMeetings = confirmedBookings.map(b => {
      const date = b.confirmedDate ?? b.desiredDate
      const time = b.confirmedTime ?? b.desiredTime
      const scheduledAt = date
        ? time ? new Date(`${date}T${time}:00`).toISOString() : new Date(`${date}T00:00:00`).toISOString()
        : null
      return {
        id: `booking-${b.id}`,
        bookingId: b.id,
        title: b.service.title,
        scheduledAt,
        roomName: null,
        type: 'booking' as const,
        duration: b.service.duration,
      }
    })

    const allMeetings = [...conferenceMeetings, ...bookingMeetings].sort((a, b) => {
      if (!a.scheduledAt) return 1
      if (!b.scheduledAt) return -1
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    })

    return NextResponse.json({
      student,
      errors: errors.map(e => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        description: e.description,
        fragment: e.fragment,
        isCorrection: e.isCorrection,
        categories: e.categories.map(c => ({
          id: c.categoryId,
          name: c.category.translations[0]?.name ?? c.category.slug,
        })),
      })),
      meetings: allMeetings,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/teacher/student-detail?errorId=xxx — remove a student error (teacher can fix up records)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const errorId = req.nextUrl.searchParams.get('errorId')
    if (!errorId) return NextResponse.json({ error: 'errorId required' }, { status: 400 })

    const error = await prisma.studentError.findUnique({
      where: { id: errorId },
      select: { id: true, studentId: true },
    })
    if (!error) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const link = await prisma.teacherStudent.findFirst({
      where: { teacherId: session.user.id, studentId: error.studentId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.studentError.delete({ where: { id: errorId } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
