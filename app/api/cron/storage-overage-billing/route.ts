import { prisma } from '@/shared/prisma/prisma'
import { getUsedBytes, QUOTA_BYTES } from '@/shared/lib/tutorFiles/storage'
import { chargeStorageOverage, getWalletPricingSettings } from '@/shared/lib/wallet/wallet'
import { NextRequest, NextResponse } from 'next/server'

// Runs once a month (see vercel.json: 03:00 UTC on the 1st). Every VIP
// teacher over QUOTA_BYTES (src/shared/lib/tutorFiles/storage.ts) gets
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

  const { storageOveragePriceCentsPerGbMonth } = await getWalletPricingSettings()

  const now = new Date()
  const vipTeachers = await prisma.teacher.findMany({
    where: { isVip: true, OR: [{ vipExpiresAt: null }, { vipExpiresAt: { gt: now } }] },
    select: { id: true },
  })

  let billed = 0
  for (const teacher of vipTeachers) {
    const usedBytes = await getUsedBytes(teacher.id)
    if (usedBytes <= QUOTA_BYTES) continue

    const overageGb = Math.ceil((usedBytes - QUOTA_BYTES) / 1024 ** 3)
    await chargeStorageOverage(teacher.id, overageGb, storageOveragePriceCentsPerGbMonth, now)
    billed++
  }

  return NextResponse.json({ ok: true, checked: vipTeachers.length, billed })
}
