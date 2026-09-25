import { getWalletSessionUser } from '@/shared/lib/wallet/wallet'
import { getRecurringReceipts } from '@/shared/lib/wallet/receipts'
import { NextResponse } from 'next/server'

// GET /api/wallet/receipts — receipt cards for recurring charges on /wallet
// (monthly VIP fee, pinned listing, featured posts, storage). Session only.
export async function GET() {
  try {
    const user = await getWalletSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ receipts: await getRecurringReceipts(user) })
  } catch (e) {
    console.error('[GET /api/wallet/receipts]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
