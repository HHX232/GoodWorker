'use client'

import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOURS,
  HOUR_HEIGHT,
  formatDateKey,
  getCurrentTimeTop,
  getEventHeight,
  getEventTop,
  getEventsForDay,
  isToday,
  minutesToTime,
  roundToHalfHour
} from '@/shared/helpers/calendar/calendar.helpers'
import {LUNCH_BREAKS} from '@/shared/helpers/calendar/calendar.mock'
import {CalendarEvent, CalendarTask} from '@/shared/types/Calendar/calendar.types'
import {CalendarEventCard} from '@/shared/ui/Calendar/CalendarEventCard/CalendarEventCard'
import {useEffect, useRef, useState} from 'react'
import {CalendarTaskModal} from '../Modals/CalendarTaskModal/CalendarTaskModal'
import styles from './DayCalendar.module.scss'

interface DayCalendarProps {
  day: Date
  events: CalendarEvent[]
  tasks: CalendarTask[]
  onEventClick: (event: CalendarEvent) => void
  onCellClick: (date: string, startTime: string, endTime: string) => void
  onTaskToggle: (taskId: string) => void
  onTaskSave: (task: CalendarTask) => void
}

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

const PRIORITY_MAP = {
  low: {label: 'Низкий', bg: '#EAF3DE', color: '#3B6D11'},
  medium: {label: 'Средний', bg: '#FAEEDA', color: '#633806'},
  high: {label: 'Высокий', bg: '#FCEBEB', color: '#A32D2D'}
}

export function DayCalendar({
  day,
  events,
  tasks,
  onEventClick,
  onCellClick,
  onTaskToggle,
  onTaskSave
}: DayCalendarProps) {
  const [nowTop, setNowTop] = useState(getCurrentTimeTop())
  const [hoverTop, setHoverTop] = useState<number | null>(null)
  const [activeTask, setActiveTask] = useState<CalendarTask | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => setNowTop(getCurrentTimeTop()), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = HOUR_HEIGHT * 0.5
  }, [])

  const dateKey = formatDateKey(day)
  const dayEvents = getEventsForDay(events, dateKey)
  const isWeekend = day.getDay() === 0 || day.getDay() === 6
  const showNowLine = isToday(day)

  const dayTasks = tasks.filter((t) => !t.dueDate || t.dueDate === dateKey)

  const lunchTop = getEventTop(LUNCH_BREAKS.startTime)
  const lunchHeight = getEventHeight(LUNCH_BREAKS.startTime, LUNCH_BREAKS.endTime)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    setHoverTop(Math.round(relY / (HOUR_HEIGHT / 2)) * (HOUR_HEIGHT / 2))
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const startMin = Math.min(
      roundToHalfHour(Math.round((relY / HOUR_HEIGHT) * 60) + DAY_START_HOUR * 60),
      DAY_END_HOUR * 60 - 60
    )
    onCellClick(dateKey, minutesToTime(startMin), minutesToTime(startMin + 60))
  }

  return (
    <div className={styles.root}>
      {/* Шапка */}
      <div className={styles.dayHeader}>
        <div className={styles.timeGutter} />
        <div className={styles.dayHead}>
          <span className={styles.dayName}>{DAY_NAMES[day.getDay()]}</span>
          <span className={`${styles.dayNum} ${isToday(day) ? styles.today : ''}`}>{day.getDate()}</span>
          {dayEvents.length > 0 && <span className={styles.eventCount}>{dayEvents.length} событий</span>}
        </div>
      </div>

      {/* ── Блок тасков ── */}
      {dayTasks.length > 0 && (
        <div className={styles.tasksPanel}>
          <div className={styles.tasksPanelGutter} />
          <div className={styles.tasksList}>
            <span className={styles.tasksLabel}>Задачи</span>
            {dayTasks.map((task) => (
              <button
                key={task.id}
                className={`${styles.taskChip} ${task.completed ? styles.taskChipDone : ''}`}
                onClick={() => setActiveTask(task)}
              >
                <span className={`${styles.taskDot} ${task.completed ? styles.taskDotDone : ''}`} />
                <span className={styles.taskChipTitle}>{task.title}</span>
                {task.priority && (
                  <span
                    className={styles.taskPriorityBadge}
                    style={{
                      background: PRIORITY_MAP[task.priority].bg,
                      color: PRIORITY_MAP[task.priority].color
                    }}
                  >
                    {PRIORITY_MAP[task.priority].label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Тело */}
      <div className={styles.body} ref={bodyRef}>
        <div className={styles.grid}>
          <div className={styles.timeCol}>
            {HOURS.map((h) => (
              <div key={h} className={styles.timeSlot}>
                <span className={styles.timeLabel}>{h}:00</span>
              </div>
            ))}
          </div>

          <div
            className={`${styles.dayTrack} ${isWeekend ? styles.weekend : ''}`}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverTop(null)}
          >
            {HOURS.map((h) => (
              <div key={h} className={styles.hourLine} style={{top: (h - DAY_START_HOUR) * HOUR_HEIGHT}} />
            ))}
            {HOURS.map((h) => (
              <div
                key={`h${h}`}
                className={styles.halfLine}
                style={{top: (h - DAY_START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}}
              />
            ))}

            {hoverTop !== null && <div className={styles.hoverGhost} style={{top: hoverTop}} />}

            <div className={styles.lunchBreak} style={{top: lunchTop, height: lunchHeight}}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none'>
                <path
                  d='M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 2v4M10 2v4M14 2v4'
                  stroke='#bbb'
                  strokeWidth='1.6'
                  strokeLinecap='round'
                />
              </svg>
              <span className={styles.lunchLabel}>Обед</span>
            </div>

            {dayEvents.map((event) => (
              <CalendarEventCard key={event.id} event={event} onClick={onEventClick} />
            ))}

            {isWeekend && dayEvents.length === 0 && <div className={styles.freeDay}>Выходной день</div>}

            {showNowLine && (
              <div className={styles.nowLine} style={{top: nowTop}}>
                <div className={styles.nowDot} />
                <div className={styles.nowBar} />
              </div>
            )}
          </div>
        </div>
      </div>
      <CalendarTaskModal
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onToggle={(id) => {
          onTaskToggle(id)
          setActiveTask((prev) => (prev ? {...prev, completed: !prev.completed} : null))
        }}
        onSave={(updated) => {
          onTaskSave(updated)
          setActiveTask(updated)
        }}
      />
    </div>
  )
}
