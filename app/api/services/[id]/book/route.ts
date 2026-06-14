import { prisma } from '@/shared/prisma/prisma'
import { tplServiceBooking } from '@/shared/lib/notificationTemplates'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'STUDENT') return NextResponse.json({ error: 'Only students can book services' }, { status: 403 })

  const { id: serviceId } = await params
  const { promoCode, desiredDate, desiredTime } = await req.json().catch(() => ({}))

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { promoCodes: true },
  })
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  if (service.teacherId === session.user.id) return NextResponse.json({ error: 'Cannot book own service' }, { status: 400 })

  let finalPrice = service.price
  let usedPromoCode: string | null = null
  let promoRecordId: string | null = null
  let discount = 0

  if (promoCode) {
    const code = service.promoCodes.find(p => p.code === String(promoCode).trim().toUpperCase())
    if (!code) return NextResponse.json({ error: 'Промокод не найден' }, { status: 400 })
    if (code.usageLimit !== null && code.usedCount >= code.usageLimit) {
      return NextResponse.json({ error: 'Промокод исчерпан' }, { status: 400 })
    }
    discount = code.discount
    finalPrice = service.price * (1 - discount / 100)
    usedPromoCode = code.code
    promoRecordId = code.id
  }

  const studentId = session.user.id

  // Max 3 pending bookings globally
  const pendingCount = await prisma.serviceBooking.count({
    where: { studentId, status: 'PENDING' },
  })
  if (pendingCount >= 3) {
    return NextResponse.json({ error: 'maxPending' }, { status: 400 })
  }

  // Same service + same desired date → reject; different day → allow
  if (desiredDate) {
    const sameDayBooking = await prisma.serviceBooking.findFirst({
      where: { serviceId, studentId, desiredDate, status: { in: ['PENDING', 'CONFIRMED'] } },
    })
    if (sameDayBooking) {
      return NextResponse.json({ error: 'sameDayBooking' }, { status: 400 })
    }
  } else {
    // No date provided — fall back to old one-per-service check
    const anyBooking = await prisma.serviceBooking.findFirst({
      where: { serviceId, studentId, status: { in: ['PENDING', 'CONFIRMED'] } },
    })
    if (anyBooking) {
      return NextResponse.json({ error: 'alreadyBooked' }, { status: 400 })
    }
  }

  const booking = await prisma.$transaction(async (tx) => {
    const booking = await tx.serviceBooking.create({
      data: {
        serviceId,
        studentId,
        finalPrice,
        promoCode: usedPromoCode,
        desiredDate: desiredDate ?? null,
        desiredTime: desiredTime ?? null,
      },
    })

    if (promoRecordId) {
      await tx.servicePromoCode.update({
        where: { id: promoRecordId },
        data: { usedCount: { increment: 1 } },
      })
    }

    await tx.teacherStudent.upsert({
      where: { teacherId_studentId: { teacherId: service.teacherId, studentId } },
      update: {},
      create: { teacherId: service.teacherId, studentId },
    })

    const student = await tx.student.findUnique({ where: { id: studentId }, select: { name: true } })
    const bookingTpl = tplServiceBooking(student?.name ?? 'Студент', service.title, desiredDate, desiredTime)

    await tx.notification.create({
      data: {
        type: 'SERVICE_BOOKING',
        title: bookingTpl.title,
        body: bookingTpl.body,
        titleTranslations: bookingTpl.titleTranslations,
        bodyTranslations: bookingTpl.bodyTranslations,
        payload: {
          bookingId: booking.id,
          serviceId,
          studentId,
          studentName: student?.name,
          serviceName: service.title,
          finalPrice,
          desiredDate: desiredDate ?? null,
          desiredTime: desiredTime ?? null,
        },
        teacherId: service.teacherId,
      },
    })

    return booking
  })

  return NextResponse.json({ booking, finalPrice })
}
