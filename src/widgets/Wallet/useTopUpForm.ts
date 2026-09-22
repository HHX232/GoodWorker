'use client'

import { useCallback, useEffect, useState } from 'react'

export interface WalletBalance {
  balanceCents: number
  isVip: boolean
  vipExpiresAt: string | null
}

export const MIN_DEPOSIT_DOLLARS = 1
export const MAX_DEPOSIT_DOLLARS = 1000
export const VIP_BONUS_THRESHOLD_DOLLARS = 5

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

type Translate = (key: string, values?: Record<string, string | number>) => string

// Shared top-up logic behind /wallet and the inline balance card on /vip — same
// endpoints, same validation, same success/error copy (namespace 'wallet' in
// messages/*.json). Each page renders its own markup/styles on top of this.
export function useTopUpForm(t: Translate, onSuccess?: () => void) {
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)

  const [amount, setAmount] = useState('5')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/balance')
      if (!res.ok) return
      setBalance(await res.json())
    } catch {
      // ignore — panel just keeps its last known value
    } finally {
      setBalanceLoading(false)
    }
  }, [])

  useEffect(() => { fetchBalance() }, [fetchBalance])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setFormError(null)
      setSuccessMessage(null)

      const dollars = Number(amount)
      if (!Number.isInteger(dollars) || dollars < MIN_DEPOSIT_DOLLARS || dollars > MAX_DEPOSIT_DOLLARS) {
        setFormError(t('form.invalidAmount', { min: MIN_DEPOSIT_DOLLARS, max: MAX_DEPOSIT_DOLLARS }))
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/wallet/topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountCents: dollars * 100 }),
        })
        const data = await res.json()
        if (!res.ok) {
          setFormError(data?.message || t('form.genericError'))
          return
        }
        setBalance(prev => (prev ? { ...prev, balanceCents: data.balanceCents } : prev))
        setSuccessMessage(
          data.vipMonthsGranted > 0
            ? t('form.successWithVip', { amount: dollars, months: data.vipMonthsGranted })
            : t('form.success', { amount: dollars }),
        )
        onSuccess?.()
      } catch {
        setFormError(t('form.genericError'))
      } finally {
        setSubmitting(false)
      }
    },
    [amount, t, onSuccess],
  )

  return {
    balance, balanceLoading,
    amount, setAmount,
    formError, submitting, successMessage,
    handleSubmit,
  }
}
