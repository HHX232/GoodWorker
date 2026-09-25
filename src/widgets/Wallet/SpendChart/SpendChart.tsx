'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCents } from '../useTopUpForm'
import styles from './SpendChart.module.scss'

interface DayPoint {
  dayKey: string
  label: string
  cents: number
}

const DAYS_PER_PAGE = 14

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayPoint }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipDate}>{point.label}</span>
      <span className={styles.tooltipValue}>{formatCents(point.cents)}</span>
    </div>
  )
}

// Daily AI spend, DAYS_PER_PAGE days per page; page 0 ends today, the
// arrows step back/forward in time. Rows come unaggregated from
// GET /api/wallet/spend and are bucketed here into the viewer's LOCAL days.
// Days with no spend still get a small stub bar (minPointSize) so the chart
// never reads as empty.
export function SpendChart({ refreshKey }: { refreshKey?: number }) {
  const t = useTranslations('wallet.chart')
  const locale = useLocale()
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<{ createdAt: string; amountCents: number }[] | null>(null)

  const range = useMemo(() => {
    const end = addDays(startOfDay(new Date()), 1 - page * DAYS_PER_PAGE) // exclusive
    return { from: addDays(end, -DAYS_PER_PAGE), to: end }
  }, [page])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    fetch(`/api/wallet/spend?from=${range.from.toISOString()}&to=${range.to.toISOString()}`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => { if (!cancelled) setRows(d.items ?? []) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [range, refreshKey])

  const data = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const r of rows ?? []) {
      const key = dayKey(new Date(r.createdAt))
      byDay.set(key, (byDay.get(key) ?? 0) + r.amountCents)
    }
    const points: DayPoint[] = []
    for (let i = 0; i < DAYS_PER_PAGE; i++) {
      const day = addDays(range.from, i)
      const key = dayKey(day)
      points.push({ dayKey: key, cents: byDay.get(key) ?? 0, label: day.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })
    }
    return points
  }, [rows, range, locale])

  const totalCents = data.reduce((sum, d) => sum + d.cents, 0)
  const peakCents = Math.max(0, ...data.map(d => d.cents))
  const rangeLabel = `${data[0].label} — ${data[data.length - 1].label}`

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('title')}</h2>
        <span className={styles.total}>
          {t('totalLabel')}: <strong>{formatCents(totalCents)}</strong>
        </span>
      </div>

      <div className={styles.pager}>
        <button type="button" className={styles.pagerBtn} onClick={() => setPage(p => p + 1)} aria-label={t('prev')}>
          <ChevronLeft size={16} />
        </button>
        <span className={styles.pagerLabel}>{rangeLabel}</span>
        <button
          type="button"
          className={styles.pagerBtn}
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label={t('next')}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9a9aab' }} axisLine={false} tickLine={false} interval={1} />
            <YAxis
              tick={{ fontSize: 11, fill: '#9a9aab' }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={v => formatCents(v)}
              domain={[0, (max: number) => Math.max(max, 10)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="cents" radius={[4, 4, 3, 3]} minPointSize={4} isAnimationActive animationDuration={400}>
              {data.map(d => (
                // Colors come from SpendChart.module.scss (.bar/.barPeak/.barZero)
                // so they follow the light/dark wallet theme — CSS fill beats
                // the SVG attribute recharts writes.
                <Cell
                  key={d.dayKey}
                  className={d.cents === 0 ? styles.barZero : d.cents === peakCents ? styles.barPeak : styles.bar}
                  fill="#2e3040"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {rows !== null && totalCents === 0 && <p className={styles.empty}>{t('empty')}</p>}
    </section>
  )
}
