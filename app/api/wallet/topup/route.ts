import { NextRequest, NextResponse } from 'next/server'
import { InvalidDepositAmountError, depositMock, getWalletSessionUser } from '@/shared/lib/wallet/wallet'

// POST /api/wallet/topup {amountCents} — mock deposit (no real payment
// provider yet, see spec). >= $5 also grants VIP months on top (R02).
// User comes strictly from the session (R11.2) — id is never read from body.
export async function POST(req: NextRequest) {
  try {
    const user = await getWalletSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const amountCents = body?.amountCents

    if (typeof amountCents !== 'number') {
      return NextResponse.json(
        { error: 'INVALID_AMOUNT', message: 'Сумма пополнения обязательна (в центах)' },
        { status: 400 },
      )
    }

    const result = await depositMock(user, amountCents)
    return NextResponse.json({
      balanceCents: result.balanceAfterCents,
      vipMonthsGranted: result.vipMonthsGranted,
      vipExpiresAt: result.vipExpiresAt,
    })
  } catch (e) {
    if (e instanceof InvalidDepositAmountError) {
      return NextResponse.json(
        { error: 'INVALID_AMOUNT', message: 'Сумма пополнения должна быть от $1 до $1000' },
        { status: 400 },
      )
    }
    console.error('[POST /api/wallet/topup]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
