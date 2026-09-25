import { prisma } from '@/shared/prisma/prisma'
import { getStorageAdminIds, getStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'
import { GB } from '@/shared/lib/tutorFiles/constants'
import { chargeStorageOverage, getWalletPricingSettings } from '@/shared/lib/wallet/wallet'
import { NextRequest, NextResponse } from 'next/server'

// Runs once a month (see vercel.json: 03:00 UTC on the 1st). Every VIP
// teacher over the admin-set quota (getStorageLimits, StorageSettings) gets
// charged priceCentsPerGb * overageGb via chargeStorageOverage — zero-floor,
// never blocks storage, never throws (see interfaces.md "Контракт между
// тикетами: квота"). Same VIP-expiry check as
// app/(forTeachers)/calendar/[id]/page.tsx / app/api/call/rooms/limit —
// isVip alone isn't enough, an expired vipExpiresAt means not actually VIP.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ storageOveragePriceCentsPerGbMonth }, { quotaBytes }] = await Promise.all([getWalletPricingSettings(), getStorageLimits()])

  const now = new Date()
  const vipTeachers = await prisma.teacher.findMany({
    where: { isVip: true, OR: [{ vipExpiresAt: null }, { vipExpiresAt: { gt: now } }] },
    select: { id: true },
  })
  // Admins are never billed — their quota is a hard cap (ADMIN_QUOTA_GB).
  const adminIds = await getStorageAdminIds(vipTeachers.map(t => t.id))

  // Idempotent per calendar month (UTC): a retried or manually re-fired run
  // must not charge the same month twice.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const alreadyBilled = new Set(
    (await prisma.walletTransaction.findMany({
      where: { type: 'STORAGE_OVERAGE_DEBIT', createdAt: { gte: monthStart }, teacherId: { in: vipTeachers.map(t => t.id) } },
      select: { teacherId: true },
    })).map(t => t.teacherId)
  )

  let billed = 0
  for (const teacher of vipTeachers) {
    if (alreadyBilled.has(teacher.id) || adminIds.has(teacher.id)) continue
    const usedBytes = await getUsedBytes(teacher.id)
    if (usedBytes <= quotaBytes) continue

    const overageGb = Math.ceil((usedBytes - quotaBytes) / GB)
    await chargeStorageOverage(teacher.id, overageGb, storageOveragePriceCentsPerGbMonth, now)
    billed++
  }

  return NextResponse.json({ ok: true, checked: vipTeachers.length, billed })
}
