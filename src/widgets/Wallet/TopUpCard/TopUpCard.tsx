'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { formatCents, MIN_DEPOSIT_DOLLARS, MAX_DEPOSIT_DOLLARS, VIP_BONUS_THRESHOLD_DOLLARS } from '../useTopUpForm'
import { useVipTopUpPresets } from '../useVipTopUpPresets'
import { notifyWalletChanged } from '../walletEvents'
import styles from './TopUpCard.module.scss'

interface Props {
  balanceCents: number | undefined
  balanceLoading: boolean
  onSuccess: () => void
}

// Big VIP-page-style preset grid (see TopUpSection in VipClientPage.tsx), but
// simpler: no payment-method modal (that's VIP-page theatrics), one submit
// button, and the custom-amount tile pinned first instead of last — this
// page's own topup/form copy stays USD-only like the rest of /wallet
// (formatCents, not the BYN-aware formatCentsDisplay the VIP page uses).
export function TopUpCard({ balanceCents, balanceLoading, onSuccess }: Props) {
  const t = useTranslations('wallet')
  const { pricing, monthsFor } = useVipTopUpPresets()

  const [customValue, setCustomValue] = useState('')
  const [selectedCents, setSelectedCents] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tiers = pricing?.vipBonusTiers ?? []
  const bestMinCents = tiers.length ? tiers[tiers.length - 1].minAmountCents : null

  const customCents = customValue.trim() ? Math.round(Number(customValue) * 100) : null
  const activeCents = customCents ?? selectedCents

  function selectPreset(cents: number) {
    setSelectedCents(cents)
    setCustomValue('')
    setError('')
  }

  async function handleTopUp() {
    setError('')
    setSuccess('')

    const minCents = pricing?.minDepositCents ?? MIN_DEPOSIT_DOLLARS * 100
    const maxCents = pricing?.maxDepositCents ?? MAX_DEPOSIT_DOLLARS * 100
    if (activeCents === null || !Number.isFinite(activeCents) || activeCents < minCents || activeCents > maxCents) {
      setError(t('form.invalidAmount', { min: MIN_DEPOSIT_DOLLARS, max: MAX_DEPOSIT_DOLLARS }))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: activeCents }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message || t('form.genericError'))
        return
      }
      const dollars = (activeCents / 100).toFixed(2)
      setSuccess(
        data.vipMonthsGranted > 0
          ? t('form.successWithVip', { amount: dollars, months: data.vipMonthsGranted })
          : t('form.success', { amount: dollars }),
      )
      setCustomValue('')
      setSelectedCents(null)
      notifyWalletChanged()
      onSuccess()
    } catch {
      setError(t('form.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.balanceRow}>
        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>{t('currentBalance')}</span>
          <span className={styles.balanceValue}>{balanceLoading ? '…' : formatCents(balanceCents ?? 0)}</span>
          {!balanceLoading && (balanceCents ?? 0) === 0 && (
            <span className={styles.balanceHint}>{t('zeroBalanceHint')}</span>
          )}
        </div>
        <Link href="/vip" className={styles.offersBtn}>
          {t('viewAllOffers')}
        </Link>
      </div>

      <div className={styles.header}>
        <h2 className={styles.title}>{t('form.title')}</h2>
      </div>

      <p className={styles.vipHint}>{t('form.vipHint', { threshold: VIP_BONUS_THRESHOLD_DOLLARS })}</p>

      <div className={styles.grid}>
        <label className={`${styles.tile} ${styles.tileCustom} ${customCents !== null ? styles.tileActive : ''}`}>
          <span className={styles.tileLabel}>{t('topup.custom')}</span>
          <div className={styles.customInputRow}>
            <span className={styles.currencyPrefix}>$</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_DEPOSIT_DOLLARS}
              max={MAX_DEPOSIT_DOLLARS}
              placeholder={t('topup.customPlaceholder')}
              value={customValue}
              onChange={e => { setCustomValue(e.target.value); setSelectedCents(null); setError('') }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        </label>

        {tiers.map(tier => (
          <button
            key={tier.minAmountCents}
            type="button"
            className={`${styles.tile} ${selectedCents === tier.minAmountCents ? styles.tileActive : ''}`}
            onClick={() => selectPreset(tier.minAmountCents)}
          >
            {tier.minAmountCents === bestMinCents && <span className={styles.badge}>{t('topup.bestValue')}</span>}
            <span className={styles.tileAmount}>{formatCents(tier.minAmountCents)}</span>
            <span className={styles.tileMonths}>→ {t('topup.vipMonths', { count: monthsFor(tier.minAmountCents) })}</span>
          </button>
        ))}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}
      {success && <p className={styles.successText}>{success}</p>}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleTopUp}
        disabled={submitting || activeCents === null}
      >
        {submitting
          ? t('form.submitting')
          : activeCents !== null
            ? `${t('form.submit')} · ${formatCents(activeCents)}`
            : t('form.submit')}
      </button>
    </section>
  )
}
