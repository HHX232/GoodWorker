'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import {getLocaleDayShorts, formatDateKey, getEventsForDay, isToday} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarTask} from '@/shared/types/Calendar/calendar.types'
import {useLocale} from 'next-intl'
import {useMemo} from 'react'
import styles from './MonthCalendar.module.scss'

const EVENT_COLORS = [
  '#7C6FE0',
  '#5B8DEF',
  '#48C78E',
  '#F97B6B',
  '#F5A623',
  '#A78BFA',
  '#34D399',
  '#FB7185',
  '#60A5FA',
  '#FBBF24'
]

function getColorForEvent(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]
}

interface HomeworkCalItem {
  id: string
  title: string
  dueAt: string | null
  sendAt: string | null
  href?: string
}

interface MonthCalendarProps {
  currentDate: Date
  events: any[]
  tasks?: CalendarTask[]
  homeworks?: HomeworkCalItem[]
  onEventClick: (event: any) => void
  onDayClick: (date: string) => void
  onTaskToggle?: (id: string) => void
}

export function MonthCalendar({
  currentDate,
  events,
  tasks = [],
  homeworks = [],
  onEventClick,
  onDayClick,
  onTaskToggle
}: MonthCalendarProps) {
  const locale = useLocale()
  const dayShorts = useMemo(() => getLocaleDayShorts(locale), [locale])
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = Array.from({length: 42}, (_, i) => {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > daysInMonth) return null
    return new Date(year, month, dayNum)
  })

  return (
    <div className={styles.monthGrid}>
      {dayShorts.map((d) => (
        <div key={d} className={styles.monthDayName}>
          {d}
        </div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={i} className={styles.monthCell} />

        const dateKey = formatDateKey(day)
        const dayEvents = getEventsForDay(events, dateKey)
        const dayTasks = tasks.filter((t) => t.dueDate && formatDateKey(new Date(t.dueDate)) === dateKey)
        const dayHw = homeworks.filter(h => {
          const dateStr = h.dueAt ?? h.sendAt
          if (!dateStr) return false
          // Use string slice to avoid timezone conversion issues
          return dateStr.slice(0, 10) === dateKey
        })

        const isWeekend = day.getDay() === 0 || day.getDay() === 6

        return (
          <div
            key={i}
            className={`${styles.monthCell} ${isToday(day) ? styles.monthToday : ''}`}
            onClick={() => onDayClick(dateKey)}
          >
            <span className={`${styles.monthNum} ${isWeekend ? styles.weekend : ''}`}>{day.getDate()}</span>

            {dayEvents.slice(0, 2).map((e) => (
              <div
                key={e.id}
                className={styles.monthEvent}
                style={{background: e.color ?? getColorForEvent(e.id), display: 'flex', alignItems: 'center', gap: 3}}
                onClick={(ev) => {
                  ev.stopPropagation()
                  onEventClick(e)
                }}
              >
                {e.fromTeacher && (
                  <svg width='8' height='8' viewBox='0 0 20 16' fill='rgba(255,210,60,0.95)' style={{flexShrink: 0}}>
                    <path d='M10 0L13 6L20 3L17 12H3L0 3L7 6L10 0Z' />
                    <rect x='3' y='13' width='14' height='3' rx='1' />
                  </svg>
                )}
                {e.warning && (
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%', background: '#F59E0B',
                    color: '#fff', fontSize: 8, fontWeight: 800, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 1,
                  }}>!</span>
                )}
                {e.title}
              </div>
            ))}

            {dayTasks.slice(0, 2).map((t) => (
              <div
                key={t.id}
                className={`${styles.monthTask} ${t.completed ? styles.monthTaskDone : ''}`}
                onClick={(ev) => ev.stopPropagation()}
              >
                <button
                  className={styles.monthTaskCheck}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onTaskToggle?.(t.id)
                  }}
                  aria-label='done'
                >
                  {t.completed && (
                    <svg width='8' height='8' viewBox='0 0 10 10' fill='none'>
                      <path d='M1.5 5L4 7.5L8.5 2.5' stroke='#fff' strokeWidth='1.5' strokeLinecap='round' />
                    </svg>
                  )}
                </button>
                <span className={styles.monthTaskTitle}>{t.title}</span>
              </div>
            ))}

            {dayHw.slice(0, 2).map(hw => (
              <a
                key={hw.id}
                href={hw.href ?? `/homework/results/${hw.id}`}
                className={styles.monthHw}
                onClick={ev => ev.stopPropagation()}
              >
                <span className={styles.monthHwDot} />
                {hw.title}
              </a>
            ))}

            {dayEvents.length + dayTasks.length + dayHw.length > 4 && (
              <span className={styles.monthMore}>+{dayEvents.length + dayTasks.length + dayHw.length - 4}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
