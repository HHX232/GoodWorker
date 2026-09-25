import { getMonthlyFeeStatus, getWalletSessionUser } from '@/shared/lib/wallet/wallet'
import { NextResponse } from 'next/server'

// GET /api/wallet/monthly-fee — current-period snapshot for the fee block on
// /wallet (fee, spent so far, what would be debited). Separate from
// /api/wallet/balance on purpose: that one is polled by the header badge,
// this one settles/anchors the period and runs an aggregate — only the
// wallet page needs it.
export async function GET() {
  try {
    const user = await getWalletSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json(await getMonthlyFeeStatus(user))
  } catch (e) {
    console.error('[GET /api/wallet/monthly-fee]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
