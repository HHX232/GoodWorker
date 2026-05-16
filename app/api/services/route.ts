import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const teacherId = searchParams.get('teacherId')

  if (!teacherId) {
    return NextResponse.json({ error: 'teacherId required' }, { status: 400 })
  }

  try {
    const services = await prisma.service.findMany({
      where: { teacherId },
      include: {
        category: { include: { translations: true } },
        promoCodes: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ services })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      title,
      description,
      photoUrl,
      categoryId,
      duration,
      timeFrom,
      timeTo,
      isGroup,
      price,
      promoCode,
    } = body

    if (!title || !duration || !timeFrom || !timeTo || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const service = await prisma.service.create({
      data: {
        teacherId: session.user.id,
        title,
        description: description ?? null,
        photoUrl: photoUrl ?? null,
        categoryId: categoryId ?? null,
        duration: Number(duration),
        timeFrom,
        timeTo,
        isGroup: Boolean(isGroup),
        price: Number(price),
        ...(promoCode
          ? {
              promoCodes: {
                create: {
                  code: promoCode.code,
                  discount: Number(promoCode.discount),
                  usageLimit: promoCode.usageLimit ? Number(promoCode.usageLimit) : null,
                  conditions: promoCode.conditions ?? null,
                },
              },
            }
          : {}),
      },
      include: {
        category: { include: { translations: true } },
        promoCodes: true,
      },
    })

    return NextResponse.json({ service }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
