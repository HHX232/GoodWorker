import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const studentId = session.user.id

    const service = await prisma.service.findUnique({
      where: { id },
      select: { id: true, targetStudentId: true, isPersonal: true, price: true },
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (!service.isPersonal || service.targetStudentId !== studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const booking = await prisma.serviceBooking.create({
      data: {
        serviceId: service.id,
        studentId,
        status: 'CONFIRMED',
        finalPrice: service.price,
      },
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to accept service' }, { status: 500 })
  }
}
