import { NextRequest, NextResponse } from 'next/server'
import { getWalletSessionUser, listTransactions } from '@/shared/lib/wallet/wallet'

// GET /api/wallet/transactions?cursor=&limit= — cursor-paginated ledger
// history (deposits + AI debits), newest first. Same pagination shape as
// GET /api/chat/conversations/[id]/messages. User strictly from session.
export async function GET(req: NextRequest) {
  try {
    const user = await getWalletSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cursor = req.nextUrl.searchParams.get('cursor')
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined

    const result = await listTransactions(user, cursor, limit)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[GET /api/wallet/transactions]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
