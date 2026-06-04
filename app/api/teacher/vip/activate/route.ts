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
    let amount = 0
    let promoCodeId: string | undefined
    let promoDescription: string | null = null

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
      promoCodeId = promo.id
      promoDescription = promo.description
    }

    const now = new Date()
    const transactionType = promoCodeId ? 'VIP_PROMO' : ('VIP_PURCHASE' as const)
    const transactionDesc = promoDescription ?? `VIP активирован на ${vipDays} дней`

    if (role === 'TEACHER') {
      const current = await prisma.teacher.findUnique({
        where: { id: userId },
        select: { vipExpiresAt: true },
      })
      const base = current?.vipExpiresAt && current.vipExpiresAt > now ? current.vipExpiresAt : now
      const newExpiry = new Date(base.getTime() + vipDays * 24 * 60 * 60 * 1000)

      await prisma.$transaction([
        prisma.teacher.update({
          where: { id: userId },
          data: { isVip: true, vipExpiresAt: newExpiry },
        }),
        prisma.vipTransaction.create({
          data: {
            teacherId: userId,
            userRole: 'TEACHER',
            type: transactionType,
            amount,
            description: transactionDesc,
            promoCodeId: promoCodeId ?? null,
            vipGrantedUntil: newExpiry,
          },
        }),
        ...(promoCodeId ? [prisma.promoCode.update({
          where: { id: promoCodeId },
          data: { usedCount: { increment: 1 } },
        })] : []),
      ])

      return NextResponse.json({ success: true, promoDescription, vipUntil: newExpiry })
    }

    // STUDENT
    const current = await prisma.student.findUnique({
      where: { id: userId },
      select: { vipExpiresAt: true },
    })
    const base = current?.vipExpiresAt && current.vipExpiresAt > now ? current.vipExpiresAt : now
    const newExpiry = new Date(base.getTime() + vipDays * 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.student.update({
        where: { id: userId },
        data: { isVip: true, vipExpiresAt: newExpiry },
      }),
      prisma.vipTransaction.create({
        data: {
          studentId: userId,
          userRole: 'STUDENT',
          type: transactionType,
          amount,
          description: transactionDesc,
          promoCodeId: promoCodeId ?? null,
          vipGrantedUntil: newExpiry,
        },
      }),
      ...(promoCodeId ? [prisma.promoCode.update({
        where: { id: promoCodeId },
        data: { usedCount: { increment: 1 } },
      })] : []),
    ])

    return NextResponse.json({ success: true, promoDescription, vipUntil: newExpiry })
  } catch (error) {
    console.error('[POST /api/teacher/vip/activate]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
