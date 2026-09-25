import { prisma } from '@/shared/prisma/prisma'
import { settleMonthlyFee, type WalletUser } from '@/shared/lib/wallet/wallet'
import { MONTHLY_FEE_PERIOD_DAYS } from '@/shared/lib/wallet/pricing'
import { NextRequest, NextResponse } from 'next/server'

// Runs daily (see vercel.json). Monthly-fee periods are anchored to when each
// user obtained VIP, not to the calendar, so every day some periods end —
// settleMonthlyFee closes the ones that already did (a no-op for the rest)
// and debits max(0, fee - spent on features in that period).
//
// Also starts the period for active VIPs that have no anchor yet (VIP granted
// by promo code / referral / admin — only the wallet deposit sets it itself).
// Clearing the anchor of a user whose VIP lapsed happens inside settleMonthlyFee.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const activeVip = { isVip: true, OR: [{ vipExpiresAt: null }, { vipExpiresAt: { gt: now } }] }

  const [teachersAnchored, studentsAnchored] = await Promise.all([
    prisma.teacher.updateMany({ where: { ...activeVip, vipFeePeriodStart: null }, data: { vipFeePeriodStart: now } }),
    prisma.student.updateMany({ where: { ...activeVip, vipFeePeriodStart: null }, data: { vipFeePeriodStart: now } }),
  ])

  const due = { vipFeePeriodStart: { lte: new Date(now.getTime() - MONTHLY_FEE_PERIOD_DAYS * 24 * 60 * 60 * 1000) } }
  const [teachers, students] = await Promise.all([
    prisma.teacher.findMany({ where: due, select: { id: true } }),
    prisma.student.findMany({ where: due, select: { id: true } }),
  ])
  const users: WalletUser[] = [
    ...teachers.map(t => ({ id: t.id, role: 'TEACHER' as const })),
    ...students.map(s => ({ id: s.id, role: 'STUDENT' as const })),
  ]

  let periodsClosed = 0
  let chargedCents = 0
  for (const user of users) {
    try {
      const r = await settleMonthlyFee(user, now)
      periodsClosed += r.periodsClosed
      chargedCents += r.chargedCents
    } catch (e) {
      console.error(`[cron/wallet-monthly-fee] ${user.role} ${user.id}`, e)
    }
  }

  return NextResponse.json({
    ok: true,
    anchored: teachersAnchored.count + studentsAnchored.count,
    checked: users.length,
    periodsClosed,
    chargedCents,
  })
}
