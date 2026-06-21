'use client'
import {useMemo, useState} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import {Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
import ModalWindowDefault from '../../Modals/ModalWindowDefault/ModalWindowDefault'
import {useThemeCtx} from '@/app/providers/ThemeContext'
import styles from './HoursChart.module.scss'

function CustomTooltip({active, payload, label, dayLabel, hoursUnit}: {active?: boolean; payload?: {value: number}[]; label?: string; dayLabel: string; hoursUnit: string}) {
  if (active && payload?.length) {
    return (
      <div className={styles.tooltip}>
        <span className={styles.tooltip__day}>{dayLabel.replace('{day}', label ?? '')}</span>
        <span className={styles.tooltip__val}>{payload[0].value} {hoursUnit}</span>
      </div>
    )
  }
  return null
}

function HoursChart({
  extraClass,
  monthsData,
}: {
  extraClass?: string
  monthsData?: Record<string, {day: string; hours: number}[]>
}) {
  const t = useTranslations('statsPage.hoursChart')
  const locale = useLocale()
  const MONTHS = monthsData ? Object.keys(monthsData) : []
  const {isDark} = useThemeCtx()

  // Translate ISO key "2026-06" → "June 2026" in user locale
  const formatMonthKey = (key: string) => {
    const [year, month] = key.split('-')
    if (!year || !month) return key
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
      .format(new Date(+year, +month - 1, 1))
  }
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Pick the latest month by default when data loads
  const activeMonth = selectedMonth && monthsData?.[selectedMonth] ? selectedMonth : (MONTHS[MONTHS.length - 1] ?? '')
  const data = (monthsData?.[activeMonth] ?? []).filter((_, i, arr) => {
    // Show every other day label if there are many bars, but keep all data
    return arr.length <= 31
  })

  const totalHours = useMemo(() => data.reduce((s, d) => s + d.hours, 0).toFixed(1), [data])
  const maxDay = useMemo(() => data.length ? data.reduce((a, b) => (a.hours > b.hours ? a : b)) : {day: '—', hours: 0}, [data])
  const activeDays = useMemo(() => data.filter((d) => d.hours > 0).length, [data])
  const avgHours = useMemo(() => activeDays > 0 ? (+totalHours / activeDays).toFixed(1) : '0.0', [totalHours, activeDays])
  const avg = useMemo(() => activeDays > 0 ? +totalHours / activeDays : 0, [totalHours, activeDays])

  const getBarColor = (entry: {day: string; hours: number}, idx: number) => {
    if (isDark) {
      if (hoveredIdx !== null) {
        if (idx === hoveredIdx) return '#818cf8'
        return entry.day === maxDay.day ? '#6366f1' : 'rgba(255,255,255,0.12)'
      }
      return entry.day === maxDay.day ? '#818cf8' : 'rgba(255,255,255,0.1)'
    }
    if (hoveredIdx !== null) {
      if (idx === hoveredIdx) return '#1a1a1a'
      return entry.day === maxDay.day ? '#888' : '#e0e0e0'
    }
    return entry.day === maxDay.day ? '#1a1a1a' : '#d4d4d4'
  }

  return (
    <section className={`${styles.chart_card} ${extraClass ?? ''}`}>
      <ModalWindowDefault isOpen={false} onClose={() => {}}>
        <p></p>
      </ModalWindowDefault>
      <div className={styles.chart_header}>
        <div className={styles.chart_header__left}>
          <h3 className={styles.chart_title}>{t('title')}</h3>
          <p className={styles.chart_subtitle}>
            {t('totalFor', {month: formatMonthKey(activeMonth)})}: <strong>{totalHours} {t('hoursUnit')}</strong>
          </p>
        </div>

        <div className={styles.month_tabs}>
          {MONTHS.map((m, i) => (
            <button
              key={m}
              className={`${styles.month_tab} ${activeMonth === m ? styles.month_tab_active : ''}`}
              style={{animationDelay: `${i * 40}ms`}}
              onClick={() => setSelectedMonth(m)}
            >
              {formatMonthKey(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Stat chips вверху — анимированные */}
      <div className={styles.chart_chips}>
        <div className={styles.chip}>
          <span className={styles.chip_dot} style={{background: isDark ? '#818cf8' : '#1a1a1a'}} />
          {t('peak')}: {maxDay.day} — <strong>{maxDay.hours} {t('hoursUnit')}</strong>
        </div>
        <div className={styles.chip}>
          <span className={styles.chip_dot} style={{background: isDark ? 'rgba(255,255,255,0.15)' : '#d4d4d4', border: isDark ? 'none' : '1px solid #bbb'}} />
          {t('avg')}: <strong>{avgHours} {t('hoursUnit')}</strong>
        </div>
        <div className={styles.chip}>
          <span className={styles.chip_dot} style={{background: isDark ? 'rgba(255,255,255,0.3)' : '#888'}} />
          {t('activeDays')}: <strong>{activeDays}</strong>
        </div>
      </div>

      <div className={styles.chart_wrap}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={data} barCategoryGap='28%' onMouseLeave={() => setHoveredIdx(null)}>
            <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'} strokeDasharray='0' />
            <ReferenceLine
              y={avg}
              stroke={isDark ? 'rgba(255,255,255,0.25)' : '#bbb'}
              strokeDasharray='4 3'
              strokeWidth={1}
              label={{
                value: `avg`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: isDark ? 'rgba(255,255,255,0.25)' : '#bbb',
                dy: -4
              }}
            />
            <XAxis dataKey='day' tick={{fontSize: 10, fill: isDark ? 'rgba(255,255,255,0.3)' : '#bbb'}} axisLine={false} tickLine={false} interval={1} />
            <YAxis
              tick={{fontSize: 10, fill: isDark ? 'rgba(255,255,255,0.3)' : '#bbb'}}
              axisLine={false}
              tickLine={false}
              width={26}
              tickFormatter={(v) => `${v}${t('hoursUnit')}`}
            />
            <Tooltip content={<CustomTooltip dayLabel={t('dayTooltip')} hoursUnit={t('hoursUnit')} />} cursor={{fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}} />
            <Bar
              dataKey='hours'
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={600}
              animationEasing='ease-out'
              onMouseEnter={(_: unknown, idx: number) => setHoveredIdx(idx)}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry, index)} style={{transition: 'fill 0.15s ease'}} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default HoursChart
