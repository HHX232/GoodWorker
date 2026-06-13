'use client'

import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOURS,
  HOUR_HEIGHT,
  EVENT_COLORS,
  formatDateKey,
  getCurrentTimeTop,
  getEventHeight,
  getEventTop,
  getEventsForDay,
  isToday,
  minutesToTime,
  roundToHalfHour,
  layoutDayEvents,
  timeToMinutes,
} from '@/shared/helpers/calendar/calendar.helpers'
import {LUNCH_BREAKS} from '@/shared/helpers/calendar/calendar.mock'
import {CalendarEvent, CalendarTask} from '@/shared/types/Calendar/calendar.types'
import {CalendarEventCard} from '@/shared/ui/Calendar/CalendarEventCard/CalendarEventCard'
import {useLocale, useTranslations} from 'next-intl'
import {useCallback, useEffect, useRef, useState} from 'react'
import {CalendarTaskModal} from '../Modals/CalendarTaskModal/CalendarTaskModal'
import styles from './DayCalendar.module.scss'

interface DayCalendarDragState {
  event: CalendarEvent
  duration: number
  grabOffsetY: number
  currentTop: number
  startMin: number
  endMin: number
}

interface DayCalendarProps {
  day: Date
  events: CalendarEvent[]
  tasks: CalendarTask[]
  onEventClick: (event: CalendarEvent) => void
  onCellClick: (date: string, startTime: string, endTime: string) => void
  onTaskToggle: (taskId: string) => void
  onTaskSave: (task: CalendarTask) => void
  onEventUpdate?: (event: CalendarEvent) => void
}

export function DayCalendar({
  day,
  events,
  tasks,
  onEventClick,
  onCellClick,
  onTaskToggle,
  onTaskSave,
  onEventUpdate,
}: DayCalendarProps) {
  const t = useTranslations('calendar')
  const tTask = useTranslations('calendar.taskModal')
  const locale = useLocale()
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'

  const PRIORITY_MAP = {
    low: {label: tTask('priorityLow'), bg: '#EAF3DE', color: '#3B6D11'},
    medium: {label: tTask('priorityMedium'), bg: '#FAEEDA', color: '#633806'},
    high: {label: tTask('priorityHigh'), bg: '#FCEBEB', color: '#A32D2D'}
  }

  const [nowTop, setNowTop] = useState(getCurrentTimeTop())
  const [hoverTop, setHoverTop] = useState<number | null>(null)
  const [activeTask, setActiveTask] = useState<CalendarTask | null>(null)
  const [dragState, setDragState] = useState<DayCalendarDragState | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const suppressClickRef = useRef<string | null>(null)

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

  const handleCardDragStart = useCallback((event: CalendarEvent, grabOffsetY: number) => {
    if (event.status === 'completed' || event.status === 'cancelled') return
    const duration = timeToMinutes(event.endTime) - timeToMinutes(event.startTime)
    setDragState({
      event,
      duration,
      grabOffsetY,
      currentTop: getEventTop(event.startTime),
      startMin: timeToMinutes(event.startTime),
      endMin: timeToMinutes(event.endTime),
    })
  }, [])

  useEffect(() => {
    if (!dragState) return
    document.body.style.cursor = 'grabbing'

    const handleMouseMove = (e: MouseEvent) => {
      if (!bodyRef.current) return
      const bodyRect = bodyRef.current.getBoundingClientRect()
      const relY = e.clientY - bodyRect.top + bodyRef.current.scrollTop
      const rawTop = relY - dragState.grabOffsetY
      const halfH = HOUR_HEIGHT / 2
      const totalH = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT
      const cardH = Math.max((dragState.duration / 60) * HOUR_HEIGHT, 24)
      const snappedTop = Math.round(rawTop / halfH) * halfH
      const clampedTop = Math.max(0, Math.min(totalH - cardH, snappedTop))
      const startMin = Math.round((clampedTop / HOUR_HEIGHT) * 60) + DAY_START_HOUR * 60
      const endMin = startMin + dragState.duration
      setDragState((prev) => prev ? {...prev, currentTop: clampedTop, startMin, endMin} : null)
    }

    const handleMouseUp = () => {
      if (dragState) {
        const changed = dragState.startMin !== timeToMinutes(dragState.event.startTime)
        if (changed && onEventUpdate) {
          suppressClickRef.current = dragState.event.id
          onEventUpdate({
            ...dragState.event,
            date: dateKey,
            startTime: minutesToTime(dragState.startMin),
            endTime: minutesToTime(dragState.endMin),
          })
          setTimeout(() => { suppressClickRef.current = null }, 150)
        }
      }
      setDragState(null)
      document.body.style.cursor = ''
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDragState(null); document.body.style.cursor = '' }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.cursor = ''
    }
  }, [dragState, onEventUpdate, dateKey])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    setHoverTop(Math.round(relY / (HOUR_HEIGHT / 2)) * (HOUR_HEIGHT / 2))
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return
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
          <span className={styles.dayName}>{day.toLocaleDateString(intlLocale, {weekday: 'long'})}</span>
          <span className={`${styles.dayNum} ${isToday(day) ? styles.today : ''}`}>{day.getDate()}</span>
          {dayEvents.length > 0 && <span className={styles.eventCount}>{t('eventsCount', {count: dayEvents.length})}</span>}
        </div>
      </div>

      {/* ── Блок тасков ── */}
      {dayTasks.length > 0 && (
        <div className={styles.tasksPanel}>
          <div className={styles.tasksPanelGutter} />
          <div className={styles.tasksList}>
            <span className={styles.tasksLabel}>{t('tasksLabel')}</span>
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
            className={`${styles.dayTrack} ${isWeekend ? styles.weekend : ''} ${dragState ? styles.dragging : ''}`}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { if (!dragState) setHoverTop(null) }}
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

            {!dragState && hoverTop !== null && <div className={styles.hoverGhost} style={{top: hoverTop}} />}

            {dragState && (() => {
              const colors = EVENT_COLORS[dragState.event.color] ?? EVENT_COLORS.purple
              const ghostH = Math.max((dragState.duration / 60) * HOUR_HEIGHT, 24)
              const tooltipBelow = dragState.currentTop < 44
              return (
                <div
                  className={styles.dragGhost}
                  style={{top: dragState.currentTop, height: ghostH, background: colors.bg, borderColor: colors.border}}
                >
                  <div className={`${styles.dragTooltip} ${tooltipBelow ? styles.dragTooltipBelow : ''}`}>
                    <span className={styles.dragTime}>
                      {minutesToTime(dragState.startMin)} – {minutesToTime(dragState.endMin)}
                    </span>
                    <span className={styles.dragDate}>
                      {day.toLocaleDateString(intlLocale, {weekday: 'short', day: 'numeric', month: 'short'})}
                    </span>
                  </div>
                </div>
              )
            })()}

            <div className={styles.lunchBreak} style={{top: lunchTop, height: lunchHeight}}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none'>
                <path
                  d='M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 2v4M10 2v4M14 2v4'
                  stroke='#bbb'
                  strokeWidth='1.6'
                  strokeLinecap='round'
                />
              </svg>
              <span className={styles.lunchLabel}>{t('lunch')}</span>
            </div>

            {layoutDayEvents(dayEvents).map(({event, col, cols}) => (
              <CalendarEventCard
                key={event.id}
                event={event}
                onClick={onEventClick}
                col={col}
                cols={cols}
                onDragStart={handleCardDragStart}
                isDragging={dragState?.event.id === event.id}
                suppressClickRef={suppressClickRef}
              />
            ))}

            {isWeekend && dayEvents.length === 0 && <div className={styles.freeDay}>{t('weekend')}</div>}

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
