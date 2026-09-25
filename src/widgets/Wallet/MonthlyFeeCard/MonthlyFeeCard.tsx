'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarClock, Receipt, ShieldCheck } from 'lucide-react'
import { computeMonthlyFeeCents } from '@/shared/lib/wallet/pricing'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
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
 * Compact monthly-VIP-fee strip on /wallet: one-line rule, this period's
 * progress and projected debit, plus a "Подробнее о списаниях" link opening
 * a modal with the full explanation and worked examples.
 * Backed by GET /api/wallet/monthly-fee (settleMonthlyFee/getMonthlyFeeStatus
 * in src/shared/lib/wallet/wallet.ts).
 */
export function MonthlyFeeCard({ refreshKey }: { refreshKey?: number }) {
  const t = useTranslations('wallet.monthlyFee')
  const locale = useLocale()
  const [status, setStatus] = useState<MonthlyFeeStatus | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

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

  const details = (
    <div className={styles.details}>
      <p className={styles.sub}>{t('sub', { fee })}</p>
      <p className={styles.notCounted}>{t('notCounted')}</p>

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

      {status?.active && (
        <div className={styles.status}>
          <div className={styles.statusRow}>
            <span className={styles.blockLabel}>{t('progressLabel')}</span>
            <span className={styles.progressValue}>{t('progressValue', { spent: formatCents(status.spentCents), fee })}</span>
          </div>
          <ProgressBar progress={progress} spentCents={status.spentCents} feeCents={feeCents} />
          {status.periodStart && status.periodEnd && (
            <p className={styles.period}>
              <CalendarClock size={14} />
              {t('period', { start: fmtDate(status.periodStart), end: fmtDate(status.periodEnd) })}
            </p>
          )}
          {status.projectedChargeCents > 0
            ? <p className={styles.hint}>{t('remainingHint', { amount: formatCents(status.projectedChargeCents) })}</p>
            : <p className={styles.hint}>{t('projectedZero', { fee })}</p>}
        </div>
      )}

      <p className={styles.noDebt}>
        <ShieldCheck size={14} />
        {t('noDebt')}
      </p>
    </div>
  )

  return (
    <section className={styles.card} aria-labelledby="monthly-fee-title">
      <div className={styles.iconWrap}><Receipt size={18} /></div>

      <div className={styles.main}>
        <h2 id="monthly-fee-title" className={styles.label}>{t('label')}</h2>
        <p className={styles.short}>
          {t('short', { fee })}{' '}
          <button type="button" className={styles.moreLink} onClick={() => setDetailsOpen(true)}>
            {t('more')}
          </button>
        </p>
        {status?.active && <ProgressBar progress={progress} spentCents={status.spentCents} feeCents={feeCents} />}
      </div>

      <div className={styles.aside}>
        {!status ? (
          <span className={styles.muted}>{t('loading')}</span>
        ) : !status.active ? (
          <span className={styles.muted}>{t('inactive')}</span>
        ) : (
          <div className={`${styles.projected} ${status.projectedChargeCents === 0 ? styles.projectedZero : ''}`}>
            <div className={styles.projectedIcon}><CalendarClock size={16} /></div>
            <div className={styles.projectedText}>
              <span className={styles.projectedLabel}>
                {status.periodEnd ? t('projected', { date: fmtDate(status.periodEnd) }) : ''}
              </span>
              <span className={styles.projectedMeta}>{t('progressValue', { spent: formatCents(status.spentCents), fee })}</span>
            </div>
            <strong className={styles.projectedAmount}>{formatCents(status.projectedChargeCents)}</strong>
          </div>
        )}
      </div>

      <ModalWindowDefault isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} additionalTitle={t('more')}>
        {details}
      </ModalWindowDefault>
    </section>
  )
}

function ProgressBar({ progress, spentCents, feeCents }: { progress: number; spentCents: number; feeCents: number }) {
  return (
    <div
      className={styles.progressTrack}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={feeCents}
      aria-valuenow={Math.min(spentCents, feeCents)}
    >
      <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
    </div>
  )
}
