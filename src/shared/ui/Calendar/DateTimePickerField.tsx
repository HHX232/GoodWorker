'use client'

import {createPortal} from 'react-dom'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useLocale} from 'next-intl'
import styles from './DateTimePickerField.module.scss'

interface Props {
  date: string                        // YYYY-MM-DD
  time?: string                       // HH:MM (required when showTime=true)
  onDateChange: (d: string) => void
  onTimeChange?: (t: string) => void
  minDate?: string                    // YYYY-MM-DD
  showTime?: boolean                  // default: true when onTimeChange present
  timeOnly?: boolean                  // only show time columns, no calendar
  placeholder?: string
  className?: string
}

const DOW: Record<string, string[]> = {
  ru: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
  en: ['Mo','Tu','We','Th','Fr','Sa','Su'],
  zh: ['一','二','三','四','五','六','日'],
  hi: ['सो','मं','बु','गु','शु','श','र'],
}

const HOURS   = Array.from({length: 24}, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function toYMD(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function sod(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

function formatDisplay(date: string, time?: string): string {
  if (!date) return ''
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('ru-RU', {day: '2-digit', month: 'short', year: 'numeric'})
  return time ? `${dateStr}, ${time}` : dateStr
}

export function DateTimePickerField({
  date, time = '', onDateChange, onTimeChange,
  minDate, showTime, timeOnly = false, placeholder = 'Выбрать дату', className,
}: Props) {
  const locale = useLocale()
  const withTime = timeOnly || (showTime ?? !!onTimeChange)

  const [open, setOpen]         = useState(false)
  const [pos,  setPos]          = useState({top: 0, left: 0, width: 0})
  const triggerRef              = useRef<HTMLButtonElement>(null)
  const popoverRef              = useRef<HTMLDivElement>(null)

  // Calendar navigation
  const today   = useMemo(() => sod(new Date()), [])
  const minD    = useMemo(() => minDate ? sod(new Date(minDate)) : today, [minDate, today])
  const initD   = date ? sod(new Date(date)) : today
  const [viewYear,  setViewYear]  = useState(initD.getFullYear())
  const [viewMonth, setViewMonth] = useState(initD.getMonth())

  // Time
  const selHour   = time ? parseInt(time.split(':')[0], 10)  : -1
  const selMinute = time ? parseInt(time.split(':')[1], 10)  : -1

  const hoursRef   = useRef<HTMLDivElement>(null)
  const minutesRef = useRef<HTMLDivElement>(null)

  const dow = DOW[locale] ?? DOW.en

  const cells = useMemo(() => {
    const first    = new Date(viewYear, viewMonth, 1)
    const startDow = (first.getDay() + 6) % 7
    const dim      = new Date(viewYear, viewMonth + 1, 0).getDate()
    const arr: (number | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= dim; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [viewYear, viewMonth])

  const monthLabel = useMemo(() =>
    new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'})
      .format(new Date(viewYear, viewMonth)),
    [locale, viewYear, viewMonth]
  )

  const selDate  = date ? sod(new Date(date)) : null
  const isSelected = (d: number) =>
    selDate?.getFullYear() === viewYear && selDate?.getMonth() === viewMonth && selDate?.getDate() === d
  const isToday = (d: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
  const isDisabled = (d: number) =>
    sod(new Date(viewYear, viewMonth, d)) < minD
  const canPrev = new Date(viewYear, viewMonth, 0) >= minD

  const prevMonth = () => viewMonth === 0
    ? (setViewYear(y => y - 1), setViewMonth(11))
    : setViewMonth(m => m - 1)
  const nextMonth = () => viewMonth === 11
    ? (setViewYear(y => y + 1), setViewMonth(0))
    : setViewMonth(m => m + 1)

  const handleDay = (d: number) => {
    if (isDisabled(d)) return
    onDateChange(toYMD(viewYear, viewMonth, d))
    if (!withTime) setOpen(false)
  }

  const handleHour = (h: number) => {
    const mm = selMinute >= 0 ? String(selMinute).padStart(2, '0') : '00'
    onTimeChange?.(`${String(h).padStart(2, '0')}:${mm}`)
  }

  const handleMinute = (m: number) => {
    const hh = selHour >= 0 ? String(selHour).padStart(2, '0') : '09'
    onTimeChange?.(`${hh}:${String(m).padStart(2, '0')}`)
  }

  // Open/close + position
  const computePos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const popW = timeOnly ? 110 : withTime ? 360 : 248
    let left = r.left
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8
    setPos({top: r.bottom + 6, left: Math.max(8, left), width: r.width})
  }, [timeOnly, withTime])

  const toggle = () => {
    if (open) { setOpen(false); return }
    computePos()
    setOpen(true)
    // sync navigation to selected date
    if (date) {
      const d = new Date(date)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }

  // Scroll time columns to selection
  useEffect(() => {
    if (!open || !withTime) return
    const ITEM_H = 32
    if (hoursRef.current && selHour >= 0) {
      hoursRef.current.scrollTop = Math.max(0, selHour * ITEM_H - ITEM_H * 2)
    }
    if (minutesRef.current && selMinute >= 0) {
      const idx = MINUTES.indexOf(selMinute)
      if (idx >= 0) minutesRef.current.scrollTop = Math.max(0, idx * ITEM_H - ITEM_H * 2)
    }
  }, [open, selHour, selMinute, withTime])

  // Click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    const resize = () => computePos()
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', computePos, true)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', computePos, true)
      window.removeEventListener('resize', resize)
    }
  }, [open, computePos])

  const display = timeOnly
    ? (time || '')
    : formatDisplay(date, withTime ? time : undefined)

  const popover = open && (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{top: pos.top, left: pos.left}}
    >
      {/* Calendar section */}
      {!timeOnly && (
        <div className={styles.cal}>
          {/* Nav */}
          <div className={styles.nav}>
            <button type="button" className={styles.navBtn} onClick={prevMonth} disabled={!canPrev}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className={styles.monthLabel}>{monthLabel}</span>
            <button type="button" className={styles.navBtn} onClick={nextMonth}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          {/* Grid */}
          <div className={styles.grid}>
            {dow.map(l => <div key={l} className={styles.dowHdr}>{l}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />
              return (
                <button
                  key={`d${d}`}
                  type="button"
                  className={[
                    styles.day,
                    isSelected(d) ? styles.daySel : '',
                    isToday(d) && !isSelected(d) ? styles.dayToday : '',
                    isDisabled(d) ? styles.dayDis : '',
                  ].join(' ')}
                  onClick={() => handleDay(d)}
                  disabled={isDisabled(d)}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Time columns */}
      {withTime && (
        <div className={[styles.timeCols, timeOnly ? styles.timeColsOnly : ''].join(' ')}>
          <div className={styles.timeCol} ref={hoursRef}>
            {HOURS.map(h => (
              <button
                key={h}
                type="button"
                className={[styles.timeItem, h === selHour ? styles.timeItemSel : ''].join(' ')}
                onClick={() => handleHour(h)}
              >
                {String(h).padStart(2, '0')}
              </button>
            ))}
          </div>
          <div className={styles.timeColDivider} />
          <div className={styles.timeCol} ref={minutesRef}>
            {MINUTES.map(m => (
              <button
                key={m}
                type="button"
                className={[styles.timeItem, m === selMinute ? styles.timeItemSel : ''].join(' ')}
                onClick={() => handleMinute(m)}
              >
                {String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, open ? styles.triggerOpen : ''].join(' ')}
        onClick={toggle}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={styles.triggerIcon}>
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={display ? styles.triggerValue : styles.triggerPlaceholder}>
          {display || placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </div>
  )
}
