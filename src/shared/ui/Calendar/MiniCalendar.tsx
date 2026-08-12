'use client'

import {useMemo, useState} from 'react'
import {useLocale} from 'next-intl'
import styles from './MiniCalendar.module.scss'

interface Props {
  value: string        // YYYY-MM-DD or ''
  onChange: (date: string) => void
  minDate?: string     // YYYY-MM-DD, defaults to today
}

const DOW_LABELS: Record<string, string[]> = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  zh: ['一', '二', '三', '四', '五', '六', '日'],
  hi: ['सो', 'मं', 'बु', 'गु', 'शु', 'श', 'र'],
}

function toYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function MiniCalendar({value, onChange, minDate}: Props) {
  const locale = useLocale()

  const today = useMemo(() => startOfDay(new Date()), [])
  const minD  = useMemo(() => minDate ? startOfDay(new Date(minDate)) : today, [minDate, today])

  const initDate = value ? startOfDay(new Date(value)) : today
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initDate.getMonth())

  // Day-of-week headers starting Monday
  const dowLabels = DOW_LABELS[locale] ?? DOW_LABELS.en

  // Build grid: empty cells + day numbers
  const cells: (number | null)[] = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startDow = (first.getDay() + 6) % 7   // Mon=0 … Sun=6
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const arr: (number | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [viewYear, viewMonth])

  const monthLabel = useMemo(() =>
    new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'})
      .format(new Date(viewYear, viewMonth)),
    [locale, viewYear, viewMonth]
  )

  const selectedDate = value ? startOfDay(new Date(value)) : null

  const isSelected = (d: number) =>
    selectedDate?.getFullYear() === viewYear &&
    selectedDate?.getMonth()    === viewMonth &&
    selectedDate?.getDate()     === d

  const isToday = (d: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth()    === viewMonth &&
    today.getDate()     === d

  const isDisabled = (d: number) =>
    startOfDay(new Date(viewYear, viewMonth, d)) < minD

  const handleDay = (d: number) => {
    if (isDisabled(d)) return
    onChange(toYMD(viewYear, viewMonth, d))
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Disable prev if the entire previous month is before minDate
  const canPrev = new Date(viewYear, viewMonth, 0) >= minD

  return (
    <div className={styles.calendar}>
      {/* Navigation */}
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={prevMonth}
          disabled={!canPrev}
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button
          type="button"
          className={styles.navBtn}
          onClick={nextMonth}
          aria-label="Next month"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className={styles.grid}>
        {dowLabels.map(l => (
          <div key={l} className={styles.dowHeader}>{l}</div>
        ))}

        {/* Day cells */}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />

          const sel  = isSelected(d)
          const tod  = isToday(d)
          const dis  = isDisabled(d)

          return (
            <button
              key={`d-${d}`}
              type="button"
              className={[
                styles.day,
                sel  ? styles.selected  : '',
                tod  ? styles.today     : '',
                dis  ? styles.disabled  : '',
              ].join(' ')}
              onClick={() => handleDay(d)}
              disabled={dis}
            >
              {d}
              {tod && !sel && <span className={styles.todayDot} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
