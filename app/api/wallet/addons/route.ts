import { getWalletPricingSettings, getWalletSessionUser, InsufficientBalanceError, purchaseAddon, type AddonKind } from '@/shared/lib/wallet/wallet'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/wallet/addons {kind: 'FEATURED_POSTS' | 'PINNED_LISTING', months}
// — mock purchase (same "no real payment provider yet" status as
// /api/wallet/topup). Price is looked up server-side from the admin-
// configured WalletSettings, never trusted from the request body — a client
// could otherwise send an arbitrary priceCents and buy months for free.
export async function POST(req: NextRequest) {
  try {
    const user = await getWalletSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'TEACHER_ONLY', message: 'Эта функция доступна только репетиторам' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const kind = body?.kind as AddonKind | undefined
    const months = Number(body?.months)

    if (kind !== 'FEATURED_POSTS' && kind !== 'PINNED_LISTING') {
      return NextResponse.json({ error: 'INVALID_KIND', message: 'kind must be FEATURED_POSTS or PINNED_LISTING' }, { status: 400 })
    }
    if (!Number.isInteger(months) || months <= 0) {
      return NextResponse.json({ error: 'INVALID_MONTHS', message: 'months must be a positive integer' }, { status: 400 })
    }

    const pricing = await getWalletPricingSettings()
    let priceCents: number
    if (kind === 'FEATURED_POSTS') {
      priceCents = months * pricing.featuredPostsPriceCentsPerMonth
    } else {
      const tier = pricing.pinnedListingTiers.find(t => t.months === months)
      if (!tier) {
        return NextResponse.json({ error: 'INVALID_MONTHS', message: 'months must match one of the published pinned-listing tiers' }, { status: 400 })
      }
      priceCents = tier.priceCents
    }

    const result = await purchaseAddon(user, kind, months, priceCents)
    return NextResponse.json({ balanceCents: result.balanceAfterCents, until: result.until, priceCents })
  } catch (e) {
    if (e instanceof InsufficientBalanceError) {
      return NextResponse.json(
        { error: 'INSUFFICIENT_BALANCE', message: `Недостаточно средств: нужно ещё $${(e.neededCents / 100).toFixed(2)}`, neededCents: e.neededCents, availableCents: e.availableCents },
        { status: 402 },
      )
    }
    console.error('[POST /api/wallet/addons]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
