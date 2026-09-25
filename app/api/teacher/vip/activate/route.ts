import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const role = session?.user?.role
    const userId = session?.user?.id

    if (!userId || (role !== 'TEACHER' && role !== 'ADMIN' && role !== 'STUDENT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const promoCodeRaw: string | undefined = body.promoCode?.trim().toUpperCase()

    let vipDays = 30
    const amount = 0
    let promoCodeId: string | undefined
    let promoDescription: string | null = null
    let bonusBalanceCents = 0

    if (promoCodeRaw) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCodeRaw } })

      if (!promo || !promo.isActive) {
        return NextResponse.json({ error: 'INVALID_PROMO' }, { status: 400 })
      }
      if (promo.expiresAt && promo.expiresAt < new Date()) {
        return NextResponse.json({ error: 'PROMO_EXPIRED' }, { status: 400 })
      }
      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
        return NextResponse.json({ error: 'PROMO_EXHAUSTED' }, { status: 400 })
      }

      const existingUse = await prisma.vipTransaction.findFirst({
        where: {
          promoCodeId: promo.id,
          ...(role === 'TEACHER' || role === 'ADMIN' ? { teacherId: userId } : { studentId: userId }),
        },
      })
      if (existingUse) {
        return NextResponse.json({ error: 'ALREADY_USED' }, { status: 400 })
      }

      vipDays = promo.vipDays
      bonusBalanceCents = promo.bonusBalanceCents
      promoCodeId = promo.id
      promoDescription = promo.description
    }

    const now = new Date()
    const transactionType = promoCodeId ? 'VIP_PROMO' : ('VIP_PURCHASE' as const)
    const transactionDesc = promoDescription ?? `VIP активирован на ${vipDays} дней`

    const isTeacher = role === 'TEACHER' || role === 'ADMIN'
    const ownerId = isTeacher ? { teacherId: userId } : { studentId: userId }
    const userRole = isTeacher ? 'TEACHER' as const : 'STUDENT' as const

    // Interactive transaction: the wallet ledger row needs the post-increment
    // balance, only known once the user update inside it has run.
    const newExpiry = await prisma.$transaction(async tx => {
      const select = { isVip: true, vipExpiresAt: true, vipFeePeriodStart: true } as const
      const current = isTeacher
        ? await tx.teacher.findUnique({ where: { id: userId }, select })
        : await tx.student.findUnique({ where: { id: userId }, select })
      const wasVip = !!current?.isVip && (current.vipExpiresAt === null || current.vipExpiresAt > now)
      const base = current?.vipExpiresAt && current.vipExpiresAt > now ? current.vipExpiresAt : now
      const expiry = new Date(base.getTime() + vipDays * 24 * 60 * 60 * 1000)

      const data = {
        isVip: true,
        vipExpiresAt: expiry,
        // VIP obtained just now → the monthly-fee period starts now (same rule
        // as depositMock in src/shared/lib/wallet/wallet.ts).
        ...(!wasVip || !current?.vipFeePeriodStart ? { vipFeePeriodStart: now } : {}),
        // "Бесплатный доп. баланс" of the promo code, credited on top of VIP.
        ...(bonusBalanceCents > 0 ? { balanceCents: { increment: bonusBalanceCents } } : {}),
      }
      const updated = isTeacher
        ? await tx.teacher.update({ where: { id: userId }, data, select: { balanceCents: true } })
        : await tx.student.update({ where: { id: userId }, data, select: { balanceCents: true } })

      await tx.vipTransaction.create({
        data: {
          ...ownerId,
          userRole,
          type: transactionType,
          amount,
          description: transactionDesc,
          promoCodeId: promoCodeId ?? null,
          vipGrantedUntil: expiry,
        },
      })

      if (bonusBalanceCents > 0) {
        await tx.walletTransaction.create({
          data: {
            ...ownerId,
            userRole,
            type: 'PROMO_BONUS',
            amountCents: bonusBalanceCents,
            balanceAfterCents: updated.balanceCents,
            description: `Бонус по промокоду ${promoCodeRaw}: +$${(bonusBalanceCents / 100).toFixed(2)}`,
          },
        })
      }

      if (promoCodeId) {
        await tx.promoCode.update({ where: { id: promoCodeId }, data: { usedCount: { increment: 1 } } })
      }

      return expiry
    })

    return NextResponse.json({ success: true, promoDescription, vipUntil: newExpiry, bonusBalanceCents })
  } catch (error) {
    console.error('[POST /api/teacher/vip/activate]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
