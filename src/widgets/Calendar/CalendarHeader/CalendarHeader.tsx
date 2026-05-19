'use client'

import {formatMonthYear} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarView} from '@/shared/types/Calendar/calendar.types'
import {CalendarPicker} from '@/shared/ui/base/CalendarPicker/CalendarPicker'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'
import styles from './CalendarHeader.module.scss'

interface CalendarHeaderProps {
  currentDate: Date
  view: CalendarView
  onViewChange: (v: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onAdd: () => void
  onDateSelect?: (date: Date) => void
  onExportPDF?: () => void
  exporting?: boolean
}

export function CalendarHeader({
  currentDate,
  onPrev,
  onNext,
  onToday,
  onAdd,
  onViewChange,
  view,
  onDateSelect,
  onExportPDF,
  exporting,
}: CalendarHeaderProps) {
  const t = useTranslations('calendar')
  const locale = useLocale()
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={styles.header}>
      <div className={styles.monthWrap} ref={pickerRef}>
        <span
          className={`${styles.month} ${pickerOpen ? styles.monthOpen : ''}`}
          onClick={() => setPickerOpen((v) => !v)}
        >
          {formatMonthYear(currentDate, intlLocale).replace(/^./, (c) => c.toUpperCase())}
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
            <path
              d='M6 9l6 6 6-6'
              stroke='currentColor'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </span>

        {pickerOpen && (
          <CalendarPicker
            currentDate={currentDate}
            onSelect={(date) => {
              onDateSelect?.(date)
              setPickerOpen(false)
            }}
          />
        )}
      </div>
      <div className={styles.nav}>
        <button className={styles.navBtn} onClick={onPrev} aria-label={t('sidebar.collapse')}>
          <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
            <path
              d='M15 18l-6-6 6-6'
              stroke='currentColor'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
        <button className={styles.navBtn} onClick={onNext} aria-label={t('today')}>
          <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
            <path
              d='M9 18l6-6-6-6'
              stroke='currentColor'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
      </div>

      <button className={styles.today} onClick={onToday}>
        {t('today')}
      </button>
      <div className={styles.viewTabs}>
        {(['month', 'week', 'day'] as const).map((v) => (
          <button
            key={v}
            className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`}
            onClick={() => onViewChange(v)}
          >
            {t(v as 'month' | 'week' | 'day')}
          </button>
        ))}
      </div>
      <div className={styles.right}>
        <button className={styles.addBtn} onClick={onAdd}>
          <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
            <path d='M12 5v14M5 12h14' stroke='#fff' strokeWidth='2' strokeLinecap='round' />
          </svg>
          {t('add')}
        </button>
        <button className={styles.share} onClick={onExportPDF} disabled={exporting}>
          <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
            <path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' stroke='#ffffff' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
            <polyline points='14 2 14 8 20 8' stroke='#ffffff' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
            <line x1='16' y1='13' x2='8' y2='13' stroke='#ffffff' strokeWidth='1.8' strokeLinecap='round' />
            <line x1='16' y1='17' x2='8' y2='17' stroke='#ffffff' strokeWidth='1.8' strokeLinecap='round' />
          </svg>
          {exporting ? t('exporting') : t('exportPDF')}
        </button>
      </div>
    </div>
  )
}
