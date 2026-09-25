'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarClock, Receipt, ShieldCheck } from 'lucide-react'
import { computeMonthlyFeeCents } from '@/shared/lib/wallet/pricing'
import { formatCents } from '../useTopUpForm'
import styles from './MonthlyFeeCard.module.scss'

interface MonthlyFeeStatus {
  active: boolean
  feeCents: number
  periodStart: string | null
  periodEnd: string | null
  spentCents: number
  projectedChargeCents: number
}

// Worked examples for a $5 fee — the same three the fee was specified with.
const EXAMPLE_SPENT_CENTS = [0, 120, 600]

/**
 * The big "how the monthly VIP fee works" block on /wallet: the rule, three
 * worked examples, and (while VIP is active) this period's progress — how
 * much was already spent on features and what would be debited at the end.
 * Backed by GET /api/wallet/monthly-fee (settleMonthlyFee/getMonthlyFeeStatus
 * in src/shared/lib/wallet/wallet.ts).
 */
export function MonthlyFeeCard({ refreshKey }: { refreshKey?: number }) {
  const t = useTranslations('wallet.monthlyFee')
  const locale = useLocale()
  const [status, setStatus] = useState<MonthlyFeeStatus | null>(null)

  useEffect(() => {
    fetch('/api/wallet/monthly-fee')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setStatus(d) })
      .catch(() => {})
  }, [refreshKey])

  const feeCents = status?.feeCents ?? 500
  const fee = formatCents(feeCents)
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  const progress = status?.active ? Math.min(1, status.spentCents / Math.max(feeCents, 1)) : 0

  return (
    <section className={styles.card} aria-labelledby="monthly-fee-title">
      <div className={styles.head}>
        <div className={styles.iconWrap}><Receipt size={22} /></div>
        <div className={styles.headText}>
          <p className={styles.label}>{t('label')}</p>
          <h2 id="monthly-fee-title" className={styles.title}>{t('title', { fee })}</h2>
          <p className={styles.sub}>{t('sub', { fee })}</p>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.examples}>
          <p className={styles.blockLabel}>{t('examplesTitle')}</p>
          <div className={styles.exampleGrid}>
            {EXAMPLE_SPENT_CENTS.map(spent => {
              const charge = computeMonthlyFeeCents(feeCents, spent)
              return (
                <div key={spent} className={`${styles.example} ${charge === 0 ? styles.exampleFree : ''}`}>
                  <span className={styles.exampleSpent}>{t('exampleSpent', { amount: formatCents(spent) })}</span>
                  <span className={styles.exampleArrow} aria-hidden>↓</span>
                  <span className={styles.exampleCharge}>
                    {charge === 0 ? t('exampleFree') : t('exampleCharge', { amount: formatCents(charge) })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.status}>
          {!status ? (
            <p className={styles.muted}>{t('loading')}</p>
          ) : !status.active ? (
            <p className={styles.inactive}>{t('inactive')}</p>
          ) : (
            <>
              <div className={styles.statusRow}>
                <span className={styles.blockLabel}>{t('progressLabel')}</span>
                <span className={styles.progressValue}>
                  {t('progressValue', { spent: formatCents(status.spentCents), fee })}
                </span>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={feeCents}
                aria-valuenow={Math.min(status.spentCents, feeCents)}
              >
                <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
              </div>

              {status.periodStart && status.periodEnd && (
                <p className={styles.period}>
                  <CalendarClock size={14} />
                  {t('period', { start: fmtDate(status.periodStart), end: fmtDate(status.periodEnd) })}
                </p>
              )}

              {status.projectedChargeCents > 0 ? (
                <div className={styles.projected}>
                  <span>{t('projected', { date: status.periodEnd ? fmtDate(status.periodEnd) : '' })}</span>
                  <strong>{formatCents(status.projectedChargeCents)}</strong>
                </div>
              ) : (
                <div className={`${styles.projected} ${styles.projectedZero}`}>
                  <span>{t('projectedZero', { fee })}</span>
                  <strong>$0.00</strong>
                </div>
              )}

              {status.projectedChargeCents > 0 && (
                <p className={styles.hint}>{t('remainingHint', { amount: formatCents(status.projectedChargeCents) })}</p>
              )}
            </>
          )}

          <p className={styles.noDebt}>
            <ShieldCheck size={14} />
            {t('noDebt')}
          </p>
        </div>
      </div>
    </section>
  )
}
