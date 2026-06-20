'use client'

import {EVENT_COLORS, getEventHeight, getEventTop} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import {useRef, useState} from 'react'
import styles from './CalendarEventCard.module.scss'

interface CalendarEventCardProps {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
  /** Column index within an overlap group (0 = leftmost). Default 0. */
  col?: number
  /** Total columns in the overlap group. Default 1. */
  cols?: number
  onDragStart?: (event: CalendarEvent, grabOffsetY: number) => void
  isDragging?: boolean
  suppressClickRef?: React.MutableRefObject<string | null>
}

const OVERLAP_OFFSET_PX = 10   // horizontal shift per column
const OVERLAP_WIDTH_SHRINK = 14 // px to shrink width per additional column

export function CalendarEventCard({
  event, onClick, col = 0, cols = 1, onDragStart, isDragging, suppressClickRef,
}: CalendarEventCardProps) {
  const [hovered, setHovered] = useState(false)
  const draggable = !isDragging && event.status !== 'completed' && event.status !== 'cancelled'
  const colors = EVENT_COLORS[event.color] ?? EVENT_COLORS.purple
  const top = getEventTop(event.startTime)
  const height = Math.max(getEventHeight(event.startTime, event.endTime), 24)
  const mouseDownPosRef = useRef<{x: number; y: number} | null>(null)

  const isOverlapping = cols > 1

  const leftOffset  = isOverlapping ? `calc(3px + ${col * OVERLAP_OFFSET_PX}px)` : '3px'
  const rightOffset = isOverlapping ? `calc(3px + ${(cols - 1 - col) * OVERLAP_WIDTH_SHRINK}px)` : '3px'
  const zIndex      = isDragging ? 1 : hovered ? 20 : isOverlapping ? 2 + col : 2

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
        borderColor: colors.border,
        left: leftOffset,
        right: rightOffset,
        zIndex,
        opacity: isDragging ? 0.25 : 1,
        cursor: draggable ? 'grab' : 'pointer',
        boxShadow: hovered && !isDragging ? `0 2px 8px rgba(0,0,0,0.15)` : isOverlapping ? `0 1px 4px rgba(0,0,0,0.08)` : undefined,
        transition: 'box-shadow 0.15s, opacity 0.1s',
        ...statusStyle,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => {
        if (!draggable || !onDragStart) return
        e.stopPropagation()
        mouseDownPosRef.current = {x: e.clientX, y: e.clientY}
        const grabOffsetY = e.clientY - e.currentTarget.getBoundingClientRect().top
        onDragStart(event, grabOffsetY)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (suppressClickRef?.current === event.id) return
        const pos = mouseDownPosRef.current
        if (pos && (Math.abs(e.clientX - pos.x) > 5 || Math.abs(e.clientY - pos.y) > 5)) return
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
      {event.teacherName && (
        <div className={styles.student} style={{color: colors.title}}>
          {event.teacherName}
        </div>
      )}
      {event.fromTeacher && (
        <div className={styles.crownBadge}>
          <svg width='9' height='9' viewBox='0 0 20 16' fill='currentColor'>
            <path d='M10 0L13 6L20 3L17 12H3L0 3L7 6L10 0Z' />
            <rect x='3' y='13' width='14' height='3' rx='1' />
          </svg>
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
