'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { computeVipMonthsGranted, type PinnedListingTier, type VipBonusTier } from '@/shared/lib/wallet/pricing'
import type { WalletBalance } from './useTopUpForm'

export interface WalletPricing {
  minDepositCents: number
  maxDepositCents: number
  usdToBynRate: number
  vipBonusTiers: VipBonusTier[]
  featuredPostsPriceCentsPerMonth: number
  pinnedListingTiers: PinnedListingTier[]
}

// Drives the preset grid + custom-amount + payment modal on /vip. Deliberately
// separate from useTopUpForm (the plain single-input flow /wallet still uses)
// rather than folding presets/currency in there — /wallet doesn't need any of
// this, and bolting it on would make that simpler flow harder to follow.
export function useVipTopUpPresets() {
  const locale = useLocale()
  const isByn = locale === 'ru'

  const [pricing, setPricing] = useState<WalletPricing | null>(null)
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wallet/pricing')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setPricing(d) })
      .catch(() => {})
  }, [])

  const fetchBalance = useCallback(() => {
    fetch('/api/wallet/balance')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setBalance(d) })
      .catch(() => {})
      .finally(() => setBalanceLoading(false))
  }, [])

  useEffect(() => { fetchBalance() }, [fetchBalance])

  // Cents are always USD internally (the ledger and the DeepSeek rate table
  // both are) — this only formats for display on the ru locale.
  const formatCentsDisplay = useCallback(
    (cents: number): string => {
      if (isByn && pricing) return `${((cents / 100) * pricing.usdToBynRate).toFixed(2)} BYN`
      return `$${(cents / 100).toFixed(2)}`
    },
    [isByn, pricing],
  )

  // Parses what the user typed IN THE DISPLAYED CURRENCY back into USD cents.
  const parseDisplayToCents = useCallback(
    (raw: string): number | null => {
      const n = Number(raw.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0 || !pricing) return null
      return Math.round((isByn ? n / pricing.usdToBynRate : n) * 100)
    },
    [isByn, pricing],
  )

  const monthsFor = useCallback(
    (amountCents: number): number => (pricing ? computeVipMonthsGranted(amountCents, pricing.vipBonusTiers) : 0),
    [pricing],
  )

  return { locale, isByn, pricing, balance, balanceLoading, formatCentsDisplay, parseDisplayToCents, monthsFor, fetchBalance }
}
