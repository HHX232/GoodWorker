'use client'

import {
  getLocaleDayShorts,
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
  roundToHalfHour,
  layoutDayEvents,
  timeToMinutes,
  EVENT_COLORS,
} from '@/shared/helpers/calendar/calendar.helpers'
import {LUNCH_BREAKS} from '@/shared/helpers/calendar/calendar.mock'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import {CalendarEventCard} from '@/shared/ui/Calendar/CalendarEventCard/CalendarEventCard'
import {useLocale, useTranslations} from 'next-intl'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import styles from './WeekCalendar.module.scss'

interface DragState {
  event: CalendarEvent
  duration: number
  grabOffsetY: number
  currentCol: number
  currentTop: number
  currentDate: string
  startMin: number
  endMin: number
}

interface WeekCalendarProps {
  weekDays: Date[]
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onCellClick: (date: string, startTime: string, endTime: string) => void
  onEventUpdate?: (event: CalendarEvent) => void
}

export function WeekCalendar({weekDays, events, onEventClick, onCellClick, onEventUpdate}: WeekCalendarProps) {
  const t = useTranslations('calendar')
  const locale = useLocale()
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const dayShorts = useMemo(() => getLocaleDayShorts(locale), [locale])
  const [nowTop, setNowTop] = useState(getCurrentTimeTop())
  const [hoverSlot, setHoverSlot] = useState<{col: number; top: number} | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const suppressClickRef = useRef<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setNowTop(getCurrentTimeTop()), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = HOUR_HEIGHT * 0.5
    }
  }, [])

  const lunchTop = getEventTop(LUNCH_BREAKS.startTime)
  const lunchHeight = getEventHeight(LUNCH_BREAKS.startTime, LUNCH_BREAKS.endTime)

  const todayIndex = weekDays.findIndex((d) => isToday(d))

  const handleCardDragStart = useCallback(
    (event: CalendarEvent, grabOffsetY: number) => {
      if (event.status === 'completed' || event.status === 'cancelled') return
      const duration = timeToMinutes(event.endTime) - timeToMinutes(event.startTime)
      const initialCol = Math.max(0, weekDays.findIndex((d) => formatDateKey(d) === event.date))
      setDragState({
        event,
        duration,
        grabOffsetY,
        currentCol: initialCol,
        currentTop: getEventTop(event.startTime),
        currentDate: event.date,
        startMin: timeToMinutes(event.startTime),
        endMin: timeToMinutes(event.endTime),
      })
    },
    [weekDays],
  )

  useEffect(() => {
    if (!dragState) return

    document.body.style.cursor = 'grabbing'

    const handleMouseMove = (e: MouseEvent) => {
      if (!bodyRef.current || !gridRef.current) return
      const bodyRect = bodyRef.current.getBoundingClientRect()
      const gridRect = gridRef.current.getBoundingClientRect()

      const colWidth = (gridRect.width - 52) / weekDays.length
      const rawCol = Math.floor((e.clientX - gridRect.left - 52) / colWidth)
      const col = Math.max(0, Math.min(weekDays.length - 1, rawCol))

      const relY = e.clientY - bodyRect.top + bodyRef.current.scrollTop
      const rawTop = relY - dragState.grabOffsetY
      const halfH = HOUR_HEIGHT / 2
      const totalH = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT
      const cardH = Math.max((dragState.duration / 60) * HOUR_HEIGHT, 24)
      const snappedTop = Math.round(rawTop / halfH) * halfH
      const clampedTop = Math.max(0, Math.min(totalH - cardH, snappedTop))

      const startMin = Math.round((clampedTop / HOUR_HEIGHT) * 60) + DAY_START_HOUR * 60
      const endMin = startMin + dragState.duration
      const currentDate = formatDateKey(weekDays[col])

      setDragState((prev) =>
        prev ? {...prev, currentCol: col, currentTop: clampedTop, currentDate, startMin, endMin} : null,
      )
    }

    const handleMouseUp = () => {
      if (dragState) {
        const changed =
          dragState.currentDate !== dragState.event.date ||
          dragState.startMin !== timeToMinutes(dragState.event.startTime)
        if (changed && onEventUpdate) {
          suppressClickRef.current = dragState.event.id
          onEventUpdate({
            ...dragState.event,
            date: dragState.currentDate,
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
      if (e.key === 'Escape') {
        setDragState(null)
        document.body.style.cursor = ''
      }
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
  }, [dragState, weekDays, onEventUpdate])

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>, colIdx: number) => {
    if (dragState) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const snapped = Math.round(relY / (HOUR_HEIGHT / 2)) * (HOUR_HEIGHT / 2)
    setHoverSlot({col: colIdx, top: snapped})
  }

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>, dateKey: string) => {
    if (dragState) return
    if ((e.target as HTMLElement).closest('[data-event]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const startMin = Math.min(
      roundToHalfHour(Math.round((relY / HOUR_HEIGHT) * 60) + DAY_START_HOUR * 60),
      DAY_END_HOUR * 60 - 60
    )
    const endMin = startMin + 60
    onCellClick(dateKey, minutesToTime(startMin), minutesToTime(endMin))
  }

  return (
    <div className={styles.root}>
      <div className={styles.daysHeader}>
        <div className={styles.timeGutter} />
        {weekDays.map((day, i) => (
          <div key={i} className={styles.dayHead}>
            <span className={styles.dayName}>{dayShorts[i]}</span>
            <span className={`${styles.dayNum} ${isToday(day) ? styles.today : ''}`}>{day.getDate()}</span>
          </div>
        ))}
      </div>

      <div className={styles.body} ref={bodyRef}>
        <div className={styles.grid} ref={gridRef}>
          <div className={styles.timeCol}>
            {HOURS.map((h) => (
              <div key={h} className={styles.timeSlot}>
                <span className={styles.timeLabel}>{h}:00</span>
              </div>
            ))}
          </div>

          {weekDays.map((day, colIdx) => {
            const dateKey = formatDateKey(day)
            const dayEvents = getEventsForDay(events, dateKey)
            const isWeekend = colIdx >= 5
            const showNowLine = todayIndex !== -1 && colIdx === todayIndex
            const showDragGhost = dragState?.currentCol === colIdx
            const ghostColors = showDragGhost ? (EVENT_COLORS[dragState!.event.color] ?? EVENT_COLORS.purple) : null
            const ghostH = dragState ? Math.max((dragState.duration / 60) * HOUR_HEIGHT, 24) : 0
            const tooltipBelow = dragState ? dragState.currentTop < 44 : false
            const dragDateLabel = showDragGhost
              ? new Date(dragState!.currentDate + 'T12:00').toLocaleDateString(intlLocale, {
                  weekday: 'short', day: 'numeric', month: 'short',
                })
              : ''

            return (
              <div
                key={colIdx}
                className={`${styles.dayTrack} ${isWeekend ? styles.weekend : ''} ${dragState ? styles.dragging : ''}`}
                onClick={(e) => handleTrackClick(e, dateKey)}
                onMouseMove={(e) => handleTrackMouseMove(e, colIdx)}
                onMouseLeave={() => { if (!dragState) setHoverSlot(null) }}
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

                {!dragState && hoverSlot?.col === colIdx && (
                  <div className={styles.hoverGhost} style={{top: hoverSlot.top}} />
                )}

                {showDragGhost && (
                  <div
                    className={styles.dragGhost}
                    style={{
                      top: dragState!.currentTop,
                      height: ghostH,
                      background: ghostColors!.bg,
                      borderColor: ghostColors!.border,
                    }}
                  >
                    <div className={`${styles.dragTooltip} ${tooltipBelow ? styles.dragTooltipBelow : ''}`}>
                      <span className={styles.dragTime}>
                        {minutesToTime(dragState!.startMin)} – {minutesToTime(dragState!.endMin)}
                      </span>
                      <span className={styles.dragDate}>{dragDateLabel}</span>
                    </div>
                  </div>
                )}

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
            )
          })}
        </div>
      </div>
    </div>
  )
}
