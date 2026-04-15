'use client'

import {EVENT_COLORS, getEventHeight, getEventTop} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import styles from './CalendarEventCard.module.scss'

interface CalendarEventCardProps {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
}

export function CalendarEventCard({event, onClick}: CalendarEventCardProps) {
  const colors = EVENT_COLORS[event.color] ?? EVENT_COLORS.purple
  const top = getEventTop(event.startTime)
  const height = Math.max(getEventHeight(event.startTime, event.endTime), 24)

  return (
    <div
      data-event='true'
      className={styles.card}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        background: colors.bg,
        borderColor: colors.border
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(event)
      }}
    >
      <div className={styles.colorBar} style={{background: colors.border}} />
      <div className={styles.title} style={{color: colors.title}}>
        {event.title}
      </div>
      <div className={styles.time} style={{color: colors.time}}>
        {event.startTime} — {event.endTime}
      </div>
      {event.studentName && (
        <div className={styles.student} style={{color: colors.title}}>
          {event.studentName}
        </div>
      )}
    </div>
  )
}
