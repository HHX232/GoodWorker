import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: serviceId } = await params
  const { code } = await req.json().catch(() => ({}))
  if (!code) return NextResponse.json({ error: 'Укажите промокод' }, { status: 400 })

  const promo = await prisma.servicePromoCode.findUnique({
    where: { serviceId_code: { serviceId, code: String(code).toUpperCase() } },
  })
  if (!promo) return NextResponse.json({ error: 'Промокод не найден' }, { status: 404 })
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    return NextResponse.json({ error: 'Промокод исчерпан' }, { status: 400 })
  }

  return NextResponse.json({ discount: promo.discount })
}
