import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const service = await prisma.service.findUnique({ where: { id } })
    if (!service) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (service.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.service.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const service = await prisma.service.findUnique({ where: { id } })
    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (service.teacherId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { title, description, photoUrl, categoryId, duration, timeFrom, timeTo, isGroup, price, currency } = body

    const updated = await prisma.service.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description ?? null }),
        ...(photoUrl !== undefined && { photoUrl: photoUrl ?? null }),
        ...(categoryId !== undefined && { categoryId: categoryId ?? null }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(timeFrom !== undefined && { timeFrom }),
        ...(timeTo !== undefined && { timeTo }),
        ...(isGroup !== undefined && { isGroup: Boolean(isGroup) }),
        ...(price !== undefined && { price: Number(price) }),
        ...(currency !== undefined && { currency }),
      },
      include: { category: { include: { translations: true } }, promoCodes: true },
    })

    return NextResponse.json({ service: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}
