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
  roundToHalfHour
} from '@/shared/helpers/calendar/calendar.helpers'
import {LUNCH_BREAKS} from '@/shared/helpers/calendar/calendar.mock'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import {CalendarEventCard} from '@/shared/ui/Calendar/CalendarEventCard/CalendarEventCard'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useMemo, useRef, useState} from 'react'
import styles from './WeekCalendar.module.scss'

interface WeekCalendarProps {
  weekDays: Date[]
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onCellClick: (date: string, startTime: string, endTime: string) => void
}

export function WeekCalendar({weekDays, events, onEventClick, onCellClick}: WeekCalendarProps) {
  const t = useTranslations('calendar')
  const locale = useLocale()
  const dayShorts = useMemo(() => getLocaleDayShorts(locale), [locale])
  const [nowTop, setNowTop] = useState(getCurrentTimeTop())
  const [hoverSlot, setHoverSlot] = useState<{col: number; top: number} | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

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

  // Ищем индекс сегодняшнего дня — -1 если текущая неделя не содержит сегодня
  const todayIndex = weekDays.findIndex((d) => isToday(d))

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>, colIdx: number) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    // snap к получасу, ghost центрируется через margin-top: -28px в CSS
    const snapped = Math.round(relY / (HOUR_HEIGHT / 2)) * (HOUR_HEIGHT / 2)
    setHoverSlot({col: colIdx, top: snapped})
  }

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>, dateKey: string) => {
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
        <div className={styles.grid}>
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
            // линия только если сегодня реально в этой неделе и это именно эта колонка
            const showNowLine = todayIndex !== -1 && colIdx === todayIndex

            return (
              <div
                key={colIdx}
                className={`${styles.dayTrack} ${isWeekend ? styles.weekend : ''}`}
                onClick={(e) => handleTrackClick(e, dateKey)}
                onMouseMove={(e) => handleTrackMouseMove(e, colIdx)}
                onMouseLeave={() => setHoverSlot(null)}
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

                {hoverSlot?.col === colIdx && <div className={styles.hoverGhost} style={{top: hoverSlot.top}} />}

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

                {dayEvents.map((event) => (
                  <CalendarEventCard key={event.id} event={event} onClick={onEventClick} />
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
