import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    await prisma.promoCode.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/admin/promo-codes/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { isActive, description, maxUses, expiresAt, discountPercent, vipDays, bonusBalanceCents } = body
    if (bonusBalanceCents !== undefined && (!Number.isInteger(bonusBalanceCents) || bonusBalanceCents < 0 || bonusBalanceCents > 100_000)) {
      return NextResponse.json({ error: 'bonusBalanceCents must be an integer 0–100000' }, { status: 400 })
    }

    const updated = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(description !== undefined && { description: description.trim() }),
        ...(maxUses !== undefined && { maxUses: maxUses ? Number(maxUses) : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(discountPercent !== undefined && { discountPercent: discountPercent ? Number(discountPercent) : null }),
        ...(vipDays !== undefined && { vipDays: Number(vipDays) }),
        ...(bonusBalanceCents !== undefined && { bonusBalanceCents }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/admin/promo-codes/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
