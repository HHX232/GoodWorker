import { NextRequest, NextResponse } from 'next/server'
import { getWalletSessionUser, listAiSpend } from '@/shared/lib/wallet/wallet'

// GET /api/wallet/spend?from=ISO&to=ISO — raw AI_DEBIT rows in [from, to)
// for the paginated daily chart on /wallet (client buckets by local day).
export async function GET(req: NextRequest) {
  try {
    const user = await getWalletSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const from = new Date(req.nextUrl.searchParams.get('from') ?? '')
    const to = new Date(req.nextUrl.searchParams.get('to') ?? '')
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'from and to must be ISO dates' }, { status: 400 })
    }
    return NextResponse.json({ items: await listAiSpend(user, from, to) })
  } catch (e) {
    console.error('[GET /api/wallet/spend]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
