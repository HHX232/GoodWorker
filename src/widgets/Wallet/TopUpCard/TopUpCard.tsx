'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Crown } from 'lucide-react'
import { formatCents, MIN_DEPOSIT_DOLLARS, MAX_DEPOSIT_DOLLARS, VIP_BONUS_THRESHOLD_DOLLARS } from '../useTopUpForm'
import { useVipTopUpPresets } from '../useVipTopUpPresets'
import { TopUpPaymentModal } from '../TopUpPaymentModal/TopUpPaymentModal'
import styles from './TopUpCard.module.scss'

interface Props {
  balanceCents: number | undefined
  balanceLoading: boolean
  onSuccess: () => void
}

// VIP-page-style preset grid (see TopUpSection in VipClientPage.tsx) with the
// same payment step (TopUpPaymentModal: method choice, BYN on ru). The tiles
// themselves stay USD like the rest of /wallet; the custom-amount tile is
// pinned first instead of last.
export function TopUpCard({ balanceCents, balanceLoading, onSuccess }: Props) {
  const t = useTranslations('wallet')
  const { pricing, monthsFor } = useVipTopUpPresets()

  const [customValue, setCustomValue] = useState('')
  const [selectedCents, setSelectedCents] = useState<number | null>(null)
  const [paymentCents, setPaymentCents] = useState<number | null>(null)
  const [error, setError] = useState('')

  const tiers = pricing?.vipBonusTiers ?? []
  const bestMinCents = tiers.length ? tiers[tiers.length - 1].minAmountCents : null

  const customCents = customValue.trim() ? Math.round(Number(customValue) * 100) : null
  const activeCents = customCents ?? selectedCents

  function selectPreset(cents: number) {
    setSelectedCents(cents)
    setCustomValue('')
    setError('')
  }

  // Validates the amount, then hands off to the same payment step /vip uses
  // (method choice + mock POST /api/wallet/topup inside TopUpPaymentModal).
  function handleTopUp() {
    setError('')
    const minCents = pricing?.minDepositCents ?? MIN_DEPOSIT_DOLLARS * 100
    const maxCents = pricing?.maxDepositCents ?? MAX_DEPOSIT_DOLLARS * 100
    if (activeCents === null || !Number.isFinite(activeCents) || activeCents < minCents || activeCents > maxCents) {
      setError(t('form.invalidAmount', { min: MIN_DEPOSIT_DOLLARS, max: MAX_DEPOSIT_DOLLARS }))
      return
    }
    setPaymentCents(activeCents)
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
            className={`${styles.tile} ${tier.minAmountCents === bestMinCents ? styles.tileBest : ''} ${selectedCents === tier.minAmountCents ? styles.tileActive : ''}`}
            onClick={() => selectPreset(tier.minAmountCents)}
          >
            {tier.minAmountCents === bestMinCents && <span className={styles.badge}>{t('topup.bestValue')}</span>}
            <span className={styles.tileAmount}>{formatCents(tier.minAmountCents)}</span>
            <span className={styles.tileMonths}>
              <Crown size={11} />
              {t('topup.vipMonths', { count: monthsFor(tier.minAmountCents) })}
            </span>
          </button>
        ))}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleTopUp}
        disabled={activeCents === null}
      >
        {activeCents !== null
          ? `${t('form.submit')} · ${formatCents(activeCents)}`
          : t('form.submit')}
      </button>

      <TopUpPaymentModal
        amountCents={paymentCents}
        onClose={() => setPaymentCents(null)}
        onSuccess={() => { setCustomValue(''); setSelectedCents(null); onSuccess() }}
      />
    </section>
  )
}
