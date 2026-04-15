'use client'

import {formatMonthYear} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarView} from '@/shared/types/Calendar/calendar.types'
import {CalendarPicker} from '@/shared/ui/base/CalendarPicker/CalendarPicker'
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
}

export function CalendarHeader({
  currentDate,
  onPrev,
  onNext,
  onToday,
  onAdd,
  onViewChange,
  view,
  onDateSelect
}: CalendarHeaderProps) {
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
          {formatMonthYear(currentDate).replace(/^./, (c) => c.toUpperCase())}
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
        <button className={styles.navBtn} onClick={onPrev} aria-label='Предыдущая неделя'>
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
        <button className={styles.navBtn} onClick={onNext} aria-label='Следующая неделя'>
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
        Сегодня
      </button>
      <div className={styles.viewTabs}>
        {(['month', 'week', 'day'] as const).map((v) => (
          <button
            key={v}
            className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`}
            onClick={() => onViewChange(v)}
          >
            {v === 'month' ? 'Месяц' : v === 'week' ? 'Неделя' : 'День'}
          </button>
        ))}
      </div>
      <div className={styles.right}>
        <button className={styles.addBtn} onClick={onAdd}>
          <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
            <path d='M12 5v14M5 12h14' stroke='#fff' strokeWidth='2' strokeLinecap='round' />
          </svg>
          Запись
        </button>
        <button className={styles.share}>
          <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
            <path
              d='M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13'
              stroke='#ffffff'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          Поделиться
        </button>
      </div>
    </div>
  )
}
