'use client'

import {EVENT_COLORS, formatDateRu} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import {useLocale, useTranslations} from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { FEATURED_CURRENCIES, formatConverted } from '@/shared/utils/currencyConverter'
import { useState } from 'react'
import styles from './CalendarEventModal.module.scss'

interface CalendarEventModalProps {
  event: CalendarEvent | null
  onClose: () => void
  onEdit: (event: CalendarEvent) => void
  onDelete: (id: string) => void
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function CalendarEventModal({event, onClose, onEdit, onDelete}: CalendarEventModalProps) {
  const t = useTranslations('calendar.eventModal')
  const locale = useLocale()
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const [showTooltip, setShowTooltip] = useState(false)

  if (!event) return null

  const colors = EVENT_COLORS[event.color] ?? EVENT_COLORS.purple

  const meetingCost = (() => {
    if (!event.servicePrice || !event.serviceDurationMinutes) return null
    const meetingMins = event.durationMinutes
      ?? (timeToMins(event.endTime) - timeToMins(event.startTime))
    if (meetingMins <= 0) return null
    return Math.round(event.servicePrice * meetingMins / event.serviceDurationMinutes)
  })()

  const STATUS_MAP = {
    scheduled: {label: t('statusScheduled'), bg: '#E6F1FB', color: '#0C447C'},
    completed: {label: t('statusCompleted'), bg: '#E1F5EE', color: '#085041'},
    cancelled: {label: t('statusCancelled'), bg: '#FCEBEB', color: '#A32D2D'}
  }

  return (
    <ModalWindowDefault isOpen={!!event} onClose={onClose}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.eyebrow}>{t('eventLabel')}</div>
          <div className={styles.title}>
            <div className={styles.colorDot} style={{background: colors.border}} />
            {event.title}
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
            <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        {event.studentName && (
          <InfoRow icon={<PersonIcon />} label={t('studentLabel')}>
            {event.studentName}
          </InfoRow>
        )}
        <InfoRow icon={<ClockIcon />} label={t('timeLabel')}>
          {event.startTime} — {event.endTime}
        </InfoRow>
        {event.date && (
          <InfoRow icon={<CalIcon />} label={t('dateLabel')}>
            {formatDateRu(event.date, intlLocale)}
          </InfoRow>
        )}
        {event.subject && (
          <InfoRow icon={<BookIcon />} label={t('subjectLabel')}>
            <span className={styles.tag} style={{background: colors.bg, color: colors.title}}>
              {event.subject}
            </span>
          </InfoRow>
        )}
        {event.status && (
          <InfoRow icon={<CheckCircleIcon />} label={t('statusLabel')}>
            <span
              className={styles.tag}
              style={{background: STATUS_MAP[event.status].bg, color: STATUS_MAP[event.status].color}}
            >
              {STATUS_MAP[event.status].label}
            </span>
          </InfoRow>
        )}
        {meetingCost != null && (
          <InfoRow icon={<RubIcon />} label={t('costLabel')}>
            <span style={{fontWeight: 700, marginRight: 8}}>{meetingCost.toLocaleString()} ₽</span>
            {event.serviceTitle && (
              <span style={{fontSize: 11, color: '#9CA3AF', marginRight: 8}}>
                ({event.serviceTitle})
              </span>
            )}
            <span
              style={{position: 'relative', display: 'inline-block'}}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <svg
                width='14' height='14' viewBox='0 0 24 24' fill='none'
                stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'
                style={{cursor: 'pointer', color: '#9CA3AF', display: 'block'}}
              >
                <circle cx='12' cy='12' r='10' />
                <path d='M12 16v-4M12 8h.01' />
              </svg>
              {showTooltip && (
                <div className={styles.currencyTooltip}>
                  {FEATURED_CURRENCIES.slice(0, 8).map(c => (
                    <div key={c.code} className={styles.currencyRow}>
                      <span>{c.flag}</span>
                      <span>{c.code}</span>
                      <span style={{marginLeft: 'auto', fontWeight: 600}}>{formatConverted(meetingCost, c)}</span>
                    </div>
                  ))}
                </div>
              )}
            </span>
          </InfoRow>
        )}
        {event.description && (
          <div className={styles.descBlock}>
            <span className={styles.descLabel}>{t('descLabel')}</span>
            <p className={styles.descText}>{event.description}</p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.btnSecondary} onClick={() => onEdit(event)}>
          {t('edit')}
        </button>
        <button className={styles.btnDanger} onClick={() => onDelete(event.id)}>
          {t('delete')}
        </button>
      </div>
    </ModalWindowDefault>
  )
}

function InfoRow({icon, label, children}: {icon: React.ReactNode; label: string; children: React.ReactNode}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowIcon}>{icon}</div>
      <div className={styles.rowContent}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowValue}>{children}</span>
      </div>
    </div>
  )
}

const PersonIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
    <path d='M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
    <circle cx='12' cy='7' r='4' stroke='currentColor' strokeWidth='1.6' />
  </svg>
)
const ClockIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
    <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.6' />
    <path d='M12 7v5l3 3' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
)
const CalIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
    <rect x='3' y='4' width='18' height='18' rx='2' stroke='currentColor' strokeWidth='1.6' />
    <path d='M16 2v4M8 2v4M3 10h18' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
  </svg>
)
const BookIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
    <path
      d='M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path
      d='M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)
const CheckCircleIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
    <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.6' />
    <path d='M9 12l2 2 4-4' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
)
const RubIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
    <path d='M6 4h8a4 4 0 010 8H6M6 12h10M6 16h10M6 8v12' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
)
