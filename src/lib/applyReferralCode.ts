import { prisma } from '@/shared/prisma/prisma'
import { findReferralOwner, getReferralSettings } from '@/lib/referralCode'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { tplReferralReward, tplReferralWelcome } from '@/shared/lib/notificationTemplates'

export type ReferralResult =
  | { success: true; vipUntil: Date; rewardDays: number }
  | { success: false; error: 'INVALID_CODE' | 'SELF_REFERRAL' | 'REFERRAL_LIMIT_REACHED' }

function extendVipExpiry(current: Date | null | undefined, days: number, now: Date) {
  const base = current && current > now ? current : now
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}

// Grants the referrer + the newly registered friend `rewardDays` of VIP each, once per
// referred account. Called right after a new Student/Teacher row is created during registration.
export async function applyReferralCode(
  newUserId: string,
  newUserRole: 'TEACHER' | 'STUDENT',
  rawCode: string,
): Promise<ReferralResult> {
  const owner = await findReferralOwner(rawCode)
  if (!owner) return { success: false, error: 'INVALID_CODE' }
  if (owner.id === newUserId && owner.role === newUserRole) return { success: false, error: 'SELF_REFERRAL' }

  const settings = await getReferralSettings()

  if (settings.maxFreeInvites !== 0) {
    const usedCount = await prisma.referral.count({
      where: owner.role === 'TEACHER' ? { referrerTeacherId: owner.id } : { referrerStudentId: owner.id },
    })
    if (usedCount >= settings.maxFreeInvites) return { success: false, error: 'REFERRAL_LIMIT_REACHED' }
  }

  const rewardDays = settings.rewardDays
  const now = new Date()

  const [referrerCurrent, newUserCurrent] = await Promise.all([
    owner.role === 'TEACHER'
      ? prisma.teacher.findUnique({ where: { id: owner.id }, select: { vipExpiresAt: true } })
      : prisma.student.findUnique({ where: { id: owner.id }, select: { vipExpiresAt: true } }),
    newUserRole === 'TEACHER'
      ? prisma.teacher.findUnique({ where: { id: newUserId }, select: { vipExpiresAt: true } })
      : prisma.student.findUnique({ where: { id: newUserId }, select: { vipExpiresAt: true } }),
  ])

  const referrerNewExpiry = extendVipExpiry(referrerCurrent?.vipExpiresAt, rewardDays, now)
  const newUserNewExpiry = extendVipExpiry(newUserCurrent?.vipExpiresAt, rewardDays, now)

  const referrerUpdate = owner.role === 'TEACHER'
    ? prisma.teacher.update({ where: { id: owner.id }, data: { isVip: true, vipExpiresAt: referrerNewExpiry } })
    : prisma.student.update({ where: { id: owner.id }, data: { isVip: true, vipExpiresAt: referrerNewExpiry } })

  const newUserUpdate = newUserRole === 'TEACHER'
    ? prisma.teacher.update({ where: { id: newUserId }, data: { isVip: true, vipExpiresAt: newUserNewExpiry } })
    : prisma.student.update({ where: { id: newUserId }, data: { isVip: true, vipExpiresAt: newUserNewExpiry } })

  await prisma.$transaction([
    referrerUpdate,
    newUserUpdate,
    prisma.vipTransaction.create({
      data: {
        ...(owner.role === 'TEACHER' ? { teacherId: owner.id } : { studentId: owner.id }),
        userRole: owner.role,
        type: 'REFERRAL',
        amount: 0,
        description: `Бонус за приглашённого друга: +${rewardDays} дн. VIP`,
        vipGrantedUntil: referrerNewExpiry,
      },
    }),
    prisma.vipTransaction.create({
      data: {
        ...(newUserRole === 'TEACHER' ? { teacherId: newUserId } : { studentId: newUserId }),
        userRole: newUserRole,
        type: 'REFERRAL',
        amount: 0,
        description: `Бонус за регистрацию по реферальной ссылке: +${rewardDays} дн. VIP`,
        vipGrantedUntil: newUserNewExpiry,
      },
    }),
    prisma.referral.create({
      data: {
        ...(owner.role === 'TEACHER' ? { referrerTeacherId: owner.id } : { referrerStudentId: owner.id }),
        referrerRole: owner.role,
        ...(newUserRole === 'TEACHER' ? { referredTeacherId: newUserId } : { referredStudentId: newUserId }),
        referredRole: newUserRole,
        rewardDays,
      },
    }),
  ])

  const referrerNotifTpl = tplReferralReward(rewardDays)
  const newUserNotifTpl = tplReferralWelcome(rewardDays)
  await Promise.all([
    createNotification({
      type: NOTIFICATION_TYPES.REFERRAL_REWARD,
      ...referrerNotifTpl,
      payload: { rewardDays },
      ...(owner.role === 'TEACHER' ? { teacherId: owner.id } : { studentId: owner.id }),
    }).catch(() => {}),
    createNotification({
      type: NOTIFICATION_TYPES.REFERRAL_REWARD,
      ...newUserNotifTpl,
      payload: { rewardDays },
      ...(newUserRole === 'TEACHER' ? { teacherId: newUserId } : { studentId: newUserId }),
    }).catch(() => {}),
  ])

  return { success: true, vipUntil: newUserNewExpiry, rewardDays }
}
