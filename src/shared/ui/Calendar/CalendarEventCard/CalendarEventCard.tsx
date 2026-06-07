'use client'

import {EVENT_COLORS, getEventHeight, getEventTop} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import {useState} from 'react'
import styles from './CalendarEventCard.module.scss'

interface CalendarEventCardProps {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
  /** Column index within an overlap group (0 = leftmost). Default 0. */
  col?: number
  /** Total columns in the overlap group. Default 1. */
  cols?: number
}

const OVERLAP_OFFSET_PX = 10   // horizontal shift per column
const OVERLAP_WIDTH_SHRINK = 14 // px to shrink width per additional column

export function CalendarEventCard({event, onClick, col = 0, cols = 1}: CalendarEventCardProps) {
  const [hovered, setHovered] = useState(false)
  const colors = EVENT_COLORS[event.color] ?? EVENT_COLORS.purple
  const top = getEventTop(event.startTime)
  const height = Math.max(getEventHeight(event.startTime, event.endTime), 24)

  const isOverlapping = cols > 1

  // Each column: shifted right, slightly narrower
  const leftOffset  = isOverlapping ? `calc(3px + ${col * OVERLAP_OFFSET_PX}px)` : '3px'
  const rightOffset = isOverlapping ? `calc(3px + ${(cols - 1 - col) * OVERLAP_WIDTH_SHRINK}px)` : '3px'
  const zIndex      = hovered ? 20 : isOverlapping ? 2 + col : 2

  const statusStyle = event.status === 'completed'
    ? {opacity: 0.65, textDecoration: 'line-through' as const}
    : event.status === 'cancelled'
    ? {opacity: 0.4}
    : {}

  return (
    <div
      data-event='true'
      className={styles.card}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        background: colors.bg,
        borderColor: hovered ? colors.border : isOverlapping ? colors.border : colors.border,
        left: leftOffset,
        right: rightOffset,
        zIndex,
        boxShadow: hovered ? `0 2px 8px rgba(0,0,0,0.15)` : isOverlapping ? `0 1px 4px rgba(0,0,0,0.08)` : undefined,
        transition: 'box-shadow 0.15s, z-index 0s',
        ...statusStyle,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      {event.status === 'completed' && (
        <div className={styles.statusDot} style={{background: '#22c55e'}} />
      )}
      {event.status === 'cancelled' && (
        <div className={styles.statusDot} style={{background: '#ef4444'}} />
      )}
    </div>
  )
}
