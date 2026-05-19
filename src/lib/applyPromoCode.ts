import { prisma } from '@/shared/prisma/prisma'

export type PromoResult =
  | { success: true; vipUntil: Date; description: string }
  | { success: false; error: 'INVALID_PROMO' | 'PROMO_EXPIRED' | 'PROMO_EXHAUSTED' | 'ALREADY_USED' }

export async function applyPromoCode(
  userId: string,
  role: 'TEACHER' | 'STUDENT',
  rawCode: string,
): Promise<PromoResult> {
  const code = rawCode.trim().toUpperCase()

  const promo = await prisma.promoCode.findUnique({ where: { code } })
  if (!promo || !promo.isActive) return { success: false, error: 'INVALID_PROMO' }
  if (promo.expiresAt && promo.expiresAt < new Date()) return { success: false, error: 'PROMO_EXPIRED' }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { success: false, error: 'PROMO_EXHAUSTED' }

  // Check if this user already used this promo code
  const alreadyUsed = await prisma.vipTransaction.findFirst({
    where: {
      promoCodeId: promo.id,
      ...(role === 'TEACHER' ? { teacherId: userId } : { studentId: userId }),
    },
  })
  if (alreadyUsed) return { success: false, error: 'ALREADY_USED' }

  const vipDays = promo.vipDays ?? 30
  const now = new Date()

  await prisma.promoCode.update({
    where: { id: promo.id },
    data: { usedCount: { increment: 1 } },
  })

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
          type: 'VIP_PROMO',
          amount: 0,
          description: promo.description,
          promoCodeId: promo.id,
          vipGrantedUntil: newExpiry,
        },
      }),
    ])

    return { success: true, vipUntil: newExpiry, description: promo.description }
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
        type: 'VIP_PROMO',
        amount: 0,
        description: promo.description,
        promoCodeId: promo.id,
        vipGrantedUntil: newExpiry,
      },
    }),
  ])

  return { success: true, vipUntil: newExpiry, description: promo.description }
}
