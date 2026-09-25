import { getMarkupPercent, getWalletPricingSettings, setMarkupPercent, setWalletPricingSettings } from '@/shared/lib/wallet/wallet'
import type { PinnedListingTier, VipBonusTier } from '@/shared/lib/wallet/pricing'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const MIN_MARKUP_PERCENT = 0
const MAX_MARKUP_PERCENT = 500
const MIN_BYN_RATE = 0.1
const MAX_BYN_RATE = 100
const MIN_FEATURED_POSTS_PRICE_CENTS = 0
const MAX_FEATURED_POSTS_PRICE_CENTS = 100_000
const MIN_STORAGE_OVERAGE_PRICE_CENTS = 0
const MAX_STORAGE_OVERAGE_PRICE_CENTS = 100_000

function parseVipBonusTiers(raw: unknown): VipBonusTier[] | null {
  if (!Array.isArray(raw)) return null
  const tiers: VipBonusTier[] = []
  for (const item of raw) {
    const minAmountCents = Number((item as VipBonusTier)?.minAmountCents)
    const monthsPer500Cents = Number((item as VipBonusTier)?.monthsPer500Cents)
    if (!Number.isInteger(minAmountCents) || minAmountCents < 0) return null
    if (!Number.isFinite(monthsPer500Cents) || monthsPer500Cents <= 0) return null
    tiers.push({ minAmountCents, monthsPer500Cents })
  }
  tiers.sort((a, b) => a.minAmountCents - b.minAmountCents)
  return tiers
}

function parsePinnedListingTiers(raw: unknown): PinnedListingTier[] | null {
  if (!Array.isArray(raw)) return null
  const tiers: PinnedListingTier[] = []
  for (const item of raw) {
    const months = Number((item as PinnedListingTier)?.months)
    const priceCents = Number((item as PinnedListingTier)?.priceCents)
    const oldPriceCentsRaw = (item as PinnedListingTier)?.oldPriceCents
    if (!Number.isInteger(months) || months <= 0) return null
    if (!Number.isInteger(priceCents) || priceCents < 0) return null
    const tier: PinnedListingTier = { months, priceCents }
    if (oldPriceCentsRaw !== undefined && oldPriceCentsRaw !== null && oldPriceCentsRaw !== ('' as unknown)) {
      const oldPriceCents = Number(oldPriceCentsRaw)
      if (!Number.isInteger(oldPriceCents) || oldPriceCents < 0) return null
      tier.oldPriceCents = oldPriceCents
    }
    tiers.push(tier)
  }
  tiers.sort((a, b) => a.months - b.months)
  return tiers
}

export async function GET() {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [markupPercent, pricing] = await Promise.all([getMarkupPercent(), getWalletPricingSettings()])
    return NextResponse.json({ markupPercent, ...pricing })
  } catch (error) {
    console.error('[GET /api/admin/wallet-settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    if (body.markupPercent !== undefined) {
      const markupPercent = Number(body.markupPercent)
      if (!Number.isInteger(markupPercent) || markupPercent < MIN_MARKUP_PERCENT || markupPercent > MAX_MARKUP_PERCENT) {
        return NextResponse.json(
          { error: `markupPercent must be an integer between ${MIN_MARKUP_PERCENT} and ${MAX_MARKUP_PERCENT}` },
          { status: 400 },
        )
      }
      await setMarkupPercent(markupPercent)
    }

    const pricingFieldsTouched = [
      'usdToBynRate', 'vipBonusTiers', 'featuredPostsPriceCentsPerMonth', 'pinnedListingTiers', 'storageOveragePriceCentsPerGbMonth',
    ].some(k => body[k] !== undefined)

    if (pricingFieldsTouched) {
      const current = await getWalletPricingSettings()

      const usdToBynRate = body.usdToBynRate !== undefined ? Number(body.usdToBynRate) : current.usdToBynRate
      if (!Number.isFinite(usdToBynRate) || usdToBynRate < MIN_BYN_RATE || usdToBynRate > MAX_BYN_RATE) {
        return NextResponse.json({ error: `usdToBynRate must be a number between ${MIN_BYN_RATE} and ${MAX_BYN_RATE}` }, { status: 400 })
      }

      let vipBonusTiers = current.vipBonusTiers
      if (body.vipBonusTiers !== undefined) {
        const parsed = parseVipBonusTiers(body.vipBonusTiers)
        if (!parsed || parsed.length === 0) {
          return NextResponse.json({ error: 'vipBonusTiers must be a non-empty array of {minAmountCents, monthsPer500Cents}' }, { status: 400 })
        }
        vipBonusTiers = parsed
      }

      let featuredPostsPriceCentsPerMonth = current.featuredPostsPriceCentsPerMonth
      if (body.featuredPostsPriceCentsPerMonth !== undefined) {
        const price = Number(body.featuredPostsPriceCentsPerMonth)
        if (!Number.isInteger(price) || price < MIN_FEATURED_POSTS_PRICE_CENTS || price > MAX_FEATURED_POSTS_PRICE_CENTS) {
          return NextResponse.json(
            { error: `featuredPostsPriceCentsPerMonth must be an integer between ${MIN_FEATURED_POSTS_PRICE_CENTS} and ${MAX_FEATURED_POSTS_PRICE_CENTS}` },
            { status: 400 },
          )
        }
        featuredPostsPriceCentsPerMonth = price
      }

      let pinnedListingTiers = current.pinnedListingTiers
      if (body.pinnedListingTiers !== undefined) {
        const parsed = parsePinnedListingTiers(body.pinnedListingTiers)
        if (!parsed || parsed.length === 0) {
          return NextResponse.json({ error: 'pinnedListingTiers must be a non-empty array of {months, priceCents, oldPriceCents?}' }, { status: 400 })
        }
        pinnedListingTiers = parsed
      }

      let storageOveragePriceCentsPerGbMonth = current.storageOveragePriceCentsPerGbMonth
      if (body.storageOveragePriceCentsPerGbMonth !== undefined) {
        const price = Number(body.storageOveragePriceCentsPerGbMonth)
        if (!Number.isInteger(price) || price < MIN_STORAGE_OVERAGE_PRICE_CENTS || price > MAX_STORAGE_OVERAGE_PRICE_CENTS) {
          return NextResponse.json(
            { error: `storageOveragePriceCentsPerGbMonth must be an integer between ${MIN_STORAGE_OVERAGE_PRICE_CENTS} and ${MAX_STORAGE_OVERAGE_PRICE_CENTS}` },
            { status: 400 },
          )
        }
        storageOveragePriceCentsPerGbMonth = price
      }

      await setWalletPricingSettings(usdToBynRate, vipBonusTiers, featuredPostsPriceCentsPerMonth, pinnedListingTiers, storageOveragePriceCentsPerGbMonth)
    }

    const [markupPercent, pricing] = await Promise.all([getMarkupPercent(), getWalletPricingSettings()])
    return NextResponse.json({ markupPercent, ...pricing })
  } catch (error) {
    console.error('[PATCH /api/admin/wallet-settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
