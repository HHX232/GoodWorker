import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { getUsedBytes, QUOTA_BYTES } from '@/shared/lib/tutorFiles/storage'

// GET /api/tutor-files/usage — contract fixed in interfaces.md "Контракт между
// тикетами: квота": {usedBytes, quotaBytes, overageGb, priceCentsPerGbMonth}.
// This is the ONLY route that reads WalletSettings.storageOveragePriceCentsPerGbMonth
// — tickets 05/06 (UI) and 04 (billing) must read the price from here, not
// duplicate the WalletSettings read elsewhere.
export async function GET() {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const usedBytes = await getUsedBytes(user.id)
    const overageBytes = Math.max(0, usedBytes - QUOTA_BYTES)
    const overageGb = Math.ceil(overageBytes / 1024 ** 3)

    const settings = await prisma.walletSettings.findUnique({
      where: { id: 'global' },
      select: { storageOveragePriceCentsPerGbMonth: true },
    })

    return NextResponse.json({
      usedBytes,
      quotaBytes: QUOTA_BYTES,
      overageGb,
      priceCentsPerGbMonth: settings?.storageOveragePriceCentsPerGbMonth ?? 0,
    })
  } catch (e) {
    console.error('[GET /api/tutor-files/usage]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
