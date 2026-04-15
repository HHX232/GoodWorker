/* eslint-disable @typescript-eslint/no-explicit-any */
import {DAYS_SHORT, formatDateKey, getEventsForDay, isToday} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarTask} from '@/shared/types/Calendar/calendar.types'
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

interface MonthCalendarProps {
  currentDate: Date
  events: any[]
  tasks?: CalendarTask[]
  onEventClick: (event: any) => void
  onDayClick: (date: string) => void
  onTaskToggle?: (id: string) => void
}

export function MonthCalendar({
  currentDate,
  events,
  tasks = [],
  onEventClick,
  onDayClick,
  onTaskToggle
}: MonthCalendarProps) {
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
      {DAYS_SHORT.map((d) => (
        <div key={d} className={styles.monthDayName}>
          {d}
        </div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={i} className={styles.monthCell} />

        const dateKey = formatDateKey(day)
        const dayEvents = getEventsForDay(events, dateKey)
        const dayTasks = tasks.filter((t) => t.dueDate && formatDateKey(new Date(t.dueDate)) === dateKey)

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
                style={{background: e.color ?? getColorForEvent(e.id)}}
                onClick={(ev) => {
                  ev.stopPropagation()
                  onEventClick(e)
                }}
              >
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
                  aria-label='Выполнить'
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

            {dayEvents.length + dayTasks.length > 4 && (
              <span className={styles.monthMore}>+{dayEvents.length + dayTasks.length - 4}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
