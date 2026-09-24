'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCents } from '../useTopUpForm'
import styles from './SpendChart.module.scss'

interface TransactionItem {
  type: 'DEPOSIT' | 'AI_DEBIT' | 'FEATURED_POSTS_PURCHASE' | 'PINNED_LISTING_PURCHASE'
  amountCents: number
  createdAt: string
}

interface WeekPoint {
  weekKey: string
  label: string
  cents: number
}

const WEEKS_SHOWN = 12

function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const mondayOffset = (date.getDay() + 6) % 7 // Mon=0 .. Sun=6
  date.setDate(date.getDate() - mondayOffset)
  return date
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function weekKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: WeekPoint }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipDate}>{point.label}</span>
      <span className={styles.tooltipValue}>{formatCents(point.cents)}</span>
    </div>
  )
}

// Aggregates whatever AI_DEBIT rows are currently loaded into WalletPage's
// transaction list — a live view of the loaded history, not a lifetime total
// (that would need its own aggregation endpoint; not asked for here). Always
// renders a fixed last-12-weeks window ending at the current week, zero-filling
// weeks with no spend, so gaps read as "nothing spent" rather than vanishing.
export function SpendChart({ transactions }: { transactions: TransactionItem[] }) {
  const t = useTranslations('wallet.chart')
  const locale = useLocale()

  const hasAnyDebit = useMemo(() => transactions.some(tx => tx.type === 'AI_DEBIT'), [transactions])

  const data = useMemo(() => {
    const byWeek = new Map<string, number>()
    for (const tx of transactions) {
      if (tx.type !== 'AI_DEBIT') continue
      const key = weekKey(startOfWeek(new Date(tx.createdAt)))
      byWeek.set(key, (byWeek.get(key) ?? 0) + tx.amountCents)
    }

    const currentWeekStart = startOfWeek(new Date())
    const points: WeekPoint[] = []
    for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
      const weekStart = addDays(currentWeekStart, -7 * i)
      const key = weekKey(weekStart)
      points.push({
        weekKey: key,
        cents: byWeek.get(key) ?? 0,
        label: weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      })
    }
    return points
  }, [transactions, locale])

  const totalCents = useMemo(() => data.reduce((sum, d) => sum + d.cents, 0), [data])
  // Dark 3D reference (wallet-a-3d.html .bar--peak) picks out the single
  // highest bar in red — everything else stays a neutral dark grey.
  const peakCents = useMemo(() => Math.max(0, ...data.map(d => d.cents)), [data])

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('title')}</h2>
        {hasAnyDebit && (
          <span className={styles.total}>
            {t('totalLabel')}: <strong>{formatCents(totalCents)}</strong>
          </span>
        )}
      </div>

      {!hasAnyDebit ? (
        <p className={styles.empty}>{t('empty')}</p>
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9a9aab' }} axisLine={false} tickLine={false} interval={1} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9a9aab' }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={v => formatCents(v)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="cents" radius={[4, 4, 3, 3]} isAnimationActive animationDuration={500}>
                {data.map(d => (
                  <Cell key={d.weekKey} fill={d.cents === peakCents && peakCents > 0 ? '#ed0606' : '#2e3040'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
