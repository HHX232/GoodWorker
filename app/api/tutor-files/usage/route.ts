import { NextResponse } from 'next/server'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { getStoragePricing } from '@/shared/lib/tutorFiles/billing'
import { getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'
import { GB } from '@/shared/lib/tutorFiles/constants'
import type { UsageResponse } from '@/shared/types/TutorFiles/tutorFiles.types'

// GET /api/tutor-files/usage — the tutor's storage line: used / quota
// (admin-editable StorageSettings), the per-file cap, and — only in the
// Wallet build — the month-end overage charge (same ceil-GB rounding as the
// cron). The UI reads limits and prices from here only.
export async function GET() {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [usedBytes, limits, pricing] = await Promise.all([getUsedBytes(user.id), getTeacherStorageLimits(user.id), getStoragePricing()])
    const overageGb = Math.ceil(Math.max(0, usedBytes - limits.quotaBytes) / GB)

    const body: UsageResponse = {
      usedBytes,
      quotaBytes: limits.quotaBytes,
      maxFileBytes: limits.maxFileBytes,
      overageGb,
      // Admins have a hard cap and are never billed.
      billing: pricing && !limits.isAdmin ? { ...pricing, estimatedChargeCents: overageGb * pricing.priceCentsPerGbMonth } : null,
    }
    return NextResponse.json(body)
  } catch (e) {
    console.error('[GET /api/tutor-files/usage]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
