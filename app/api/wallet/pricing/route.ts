import { getWalletPricingSettings } from '@/shared/lib/wallet/wallet'
import { NextResponse } from 'next/server'

// GET /api/wallet/pricing — public (no auth): the top-up presets, BYN
// display rate and VIP-bonus tiers shown on /vip. Unlike the AI markup
// (admin-only, a cost detail), this IS the price the user sees, so guests
// need it too — same reasoning as /api/public/stats being unauthenticated.
export async function GET() {
  try {
    const pricing = await getWalletPricingSettings()
    return NextResponse.json(pricing)
  } catch (e) {
    console.error('[GET /api/wallet/pricing]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
