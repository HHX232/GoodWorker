import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function GET() {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [codes, serviceCodes] = await Promise.all([
      prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.servicePromoCode.findMany({
        orderBy: { createdAt: 'desc' },
        include: { service: { select: { id: true, title: true } } },
      }),
    ])

    return NextResponse.json({ codes, serviceCodes })
  } catch (error) {
    console.error('[GET /api/admin/promo-codes]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { rewardType, discountPercent, vipDays, description, maxUses, expiresAt, autoCode } = body

    if (!rewardType || !description?.trim()) {
      return NextResponse.json({ error: 'rewardType and description are required' }, { status: 400 })
    }
    if (rewardType === 'DISCOUNT' && (!discountPercent || discountPercent < 1 || discountPercent > 100)) {
      return NextResponse.json({ error: 'discountPercent must be 1–100 for DISCOUNT type' }, { status: 400 })
    }

    let code = (body.code as string | undefined)?.trim().toUpperCase()

    if (!code || autoCode) {
      code = generateCode()
      let attempts = 0
      while (attempts < 10) {
        const exists = await prisma.promoCode.findUnique({ where: { code } })
        if (!exists) break
        code = generateCode()
        attempts++
      }
    } else {
      const exists = await prisma.promoCode.findUnique({ where: { code } })
      if (exists) return NextResponse.json({ error: 'Промокод уже существует' }, { status: 409 })
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code,
        rewardType,
        discountPercent: rewardType === 'DISCOUNT' ? Number(discountPercent) : null,
        vipDays: rewardType === 'FREE_VIP' ? Number(vipDays ?? 30) : 0,
        description: description.trim(),
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
    })

    return NextResponse.json(promoCode, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/promo-codes]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
