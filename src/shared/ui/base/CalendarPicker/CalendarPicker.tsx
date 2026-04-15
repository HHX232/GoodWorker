'use client'

import {useState} from 'react'
import styles from './CalendarPicker.module.scss'

type PickerMode = 'day' | 'week' | 'month' | 'year'

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

interface CalendarPickerProps {
  currentDate: Date
  onSelect: (date: Date) => void
}

export function CalendarPicker({currentDate, onSelect}: CalendarPickerProps) {
  const today = new Date()
  const [mode, setMode] = useState<PickerMode>('day')
  const [viewYear, setViewYear] = useState(currentDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth())

  const renderDay = () => {
    const first = new Date(viewYear, viewMonth, 1)
    const offset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells = Array.from({length: 42}, (_, i) => {
      const d = i - offset + 1
      return d < 1 || d > daysInMonth ? null : d
    })

    return (
      <>
        <div className={styles.nav}>
          <button
            onClick={() => {
              let m = viewMonth - 1,
                y = viewYear
              if (m < 0) {
                m = 11
                y--
              }
              setViewMonth(m)
              setViewYear(y)
            }}
          >
            ‹
          </button>
          <span>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={() => {
              let m = viewMonth + 1,
                y = viewYear
              if (m > 11) {
                m = 0
                y++
              }
              setViewMonth(m)
              setViewYear(y)
            }}
          >
            ›
          </button>
        </div>
        <div className={styles.dayGrid}>
          {WEEKDAYS.map((w) => (
            <div key={w} className={styles.wd}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const col = i % 7
            const isWe = col === 5 || col === 6
            const isTod = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
            return (
              <button
                key={i}
                className={[styles.dayCell, isWe ? styles.weekend : '', isTod ? styles.today : ''].join(' ')}
                onClick={() => onSelect(new Date(viewYear, viewMonth, d))}
              >
                {d}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  const renderWeek = () => {
    const first = new Date(viewYear, viewMonth, 1)
    const offset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const weeks: number[][] = []
    let d = 1 - offset
    while (d <= daysInMonth) {
      weeks.push(Array.from({length: 7}, () => d++))
    }

    return (
      <>
        <div className={styles.nav}>
          <button
            onClick={() => {
              let m = viewMonth - 1,
                y = viewYear
              if (m < 0) {
                m = 11
                y--
              }
              setViewMonth(m)
              setViewYear(y)
            }}
          >
            ‹
          </button>
          <span>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={() => {
              let m = viewMonth + 1,
                y = viewYear
              if (m > 11) {
                m = 0
                y++
              }
              setViewMonth(m)
              setViewYear(y)
            }}
          >
            ›
          </button>
        </div>
        <div className={styles.weekList}>
          {weeks.map((week, wi) => {
            const valid = week.filter((d) => d >= 1 && d <= daysInMonth)
            if (!valid.length) return null
            return (
              <div
                key={wi}
                className={styles.weekRow}
                onClick={() => onSelect(new Date(viewYear, viewMonth, valid[0]))}
              >
                <span className={styles.weekNum}>{wi + 1}</span>
                <div className={styles.weekCells}>
                  {week.map((d, ci) => {
                    const isWe = ci === 5 || ci === 6
                    const valid = d >= 1 && d <= daysInMonth
                    const isTod =
                      valid &&
                      today.getFullYear() === viewYear &&
                      today.getMonth() === viewMonth &&
                      today.getDate() === d
                    return (
                      <div
                        key={ci}
                        className={[styles.weekDay, isWe ? styles.weekend : '', isTod ? styles.today : ''].join(' ')}
                      >
                        {valid ? d : ''}
                      </div>
                    )
                  })}
                </div>
                <span className={styles.weekRange}>
                  {valid[0]}–{valid[valid.length - 1]}
                </span>
              </div>
            )
          })}
        </div>
      </>
    )
  }

  const renderMonth = () => (
    <>
      <div className={styles.nav}>
        <button onClick={() => setViewYear((y) => y - 1)}>‹</button>
        <span>{viewYear}</span>
        <button onClick={() => setViewYear((y) => y + 1)}>›</button>
      </div>
      <div className={styles.monthGrid}>
        {MONTHS.map((name, i) => {
          const isCur = viewYear === today.getFullYear() && i === today.getMonth()
          return (
            <button
              key={i}
              className={`${styles.monthCell} ${isCur ? styles.today : ''}`}
              onClick={() => {
                setViewMonth(i)
                onSelect(new Date(viewYear, i, 1))
              }}
            >
              {name}
            </button>
          )
        })}
      </div>
    </>
  )

  const renderYear = () => {
    const base = Math.floor(viewYear / 12) * 12
    return (
      <>
        <div className={styles.nav}>
          <button onClick={() => setViewYear((y) => y - 12)}>‹</button>
          <span>
            {base}–{base + 11}
          </span>
          <button onClick={() => setViewYear((y) => y + 12)}>›</button>
        </div>
        <div className={styles.yearGrid}>
          {Array.from({length: 12}, (_, i) => base + i).map((yr) => (
            <button
              key={yr}
              className={`${styles.yearCell} ${yr === today.getFullYear() ? styles.today : ''}`}
              onClick={() => {
                setViewYear(yr)
                onSelect(new Date(yr, viewMonth, 1))
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className={styles.picker}>
      <div className={styles.modes}>
        {(['day', 'week', 'month', 'year'] as const).map((m) => (
          <button
            key={m}
            className={`${styles.modeTab} ${mode === m ? styles.modeActive : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'day' ? 'День' : m === 'week' ? 'Неделя' : m === 'month' ? 'Месяц' : 'Год'}
          </button>
        ))}
      </div>
      {mode === 'day' && renderDay()}
      {mode === 'week' && renderWeek()}
      {mode === 'month' && renderMonth()}
      {mode === 'year' && renderYear()}
    </div>
  )
}
