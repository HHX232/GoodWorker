import { NextResponse } from 'next/server'
import { getStorageLimits } from '@/shared/lib/tutorFiles/storage'

// GET /api/tutor-files/limits — public: the VIP storage quota and per-file cap
// for marketing copy (/vip), so the number there always matches the admin setting.
export async function GET() {
  try {
    const { quotaGb, maxFileMb } = await getStorageLimits()
    return NextResponse.json({ quotaGb, maxFileMb })
  } catch (e) {
    console.error('[GET /api/tutor-files/limits]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
