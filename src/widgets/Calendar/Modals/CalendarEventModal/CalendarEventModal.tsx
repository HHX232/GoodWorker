'use client'

import {EVENT_COLORS, formatDateRu} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'
import {useLocale, useTranslations} from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { FEATURED_CURRENCIES, convertBetween, formatConverted } from '@/shared/utils/currencyConverter'
import { useState } from 'react'
import styles from './CalendarEventModal.module.scss'

interface CalendarEventModalProps {
  event: CalendarEvent | null
  onClose: () => void
  onEdit: (event: CalendarEvent) => void
  onDelete: (id: string) => void
  onConfirm?: (id: string) => void
  onViewPayment?: (studentId: string) => void
  /** Ids of "checkpoint" lessons per the student's reminder cadence — see GET /api/teacher/calendar. */
  paymentDueEventIds?: Set<string>
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function CalendarEventModal({event, onClose, onEdit, onDelete, onConfirm, onViewPayment, paymentDueEventIds}: CalendarEventModalProps) {
  const t = useTranslations('calendar.eventModal')
  const locale = useLocale()
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const [showTooltip, setShowTooltip] = useState(false)

  if (!event) return null

  const paymentDue = paymentDueEventIds?.has(event.id) ?? false

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

  const modalTitle = (
    <div className={styles.modalTitle}>
      <span className={styles.eyebrow}>{t('eventLabel')}</span>
      <span className={styles.title}>
        <span className={styles.colorDot} style={{background: colors.border}} />
        {event.title}
      </span>
    </div>
  )

  return (
    <ModalWindowDefault isOpen={!!event} onClose={onClose} additionalTitle={modalTitle}>
      <div className={styles.body}>
        {event.warning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: '#FEF3C7', borderRadius: 10, marginBottom: 12,
            border: '1px solid #FDE68A',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', background: '#F59E0B',
              color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>!</span>
            <span style={{fontSize: 12, color: '#92400E', lineHeight: 1.4}}>
              Импортировано из Google Calendar. Проверьте и подтвердите запись.
            </span>
          </div>
        )}
        {paymentDue && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: '#EFF6FF', borderRadius: 10, marginBottom: 12,
            border: '1px solid #BFDBFE',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', background: '#2563EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='#fff' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M12 3c-3 3-8 3.5-8 3.5s-.5 8 8 14.5c8.5-6.5 8-14.5 8-14.5S15 6 12 3z' />
                <path d='M12 9v6M9.5 11.5h5' />
              </svg>
            </span>
            <span style={{fontSize: 12, color: '#1E40AF', lineHeight: 1.4}}>
              {t('paymentDueBadge')}
            </span>
          </div>
        )}
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
        {meetingCost != null && (() => {
          // formatConverted takes a RUB amount — convert the event's own
          // currency into RUB first, otherwise a BYN price gets displayed as
          // if it were RUB (156 BYN showing up as "≈5.62 BYN" in its own row).
          const costCurrency = event.serviceCurrency ?? 'RUB'
          const meetingCostInRub = convertBetween(meetingCost, costCurrency, 'RUB')
          const conversionTargets = FEATURED_CURRENCIES.filter(c => c.code !== costCurrency)
          return (
          <InfoRow icon={<RubIcon />} label={t('costLabel')}>
            <span style={{fontWeight: 700, marginRight: 8}}>{meetingCost.toLocaleString()} {costCurrency}</span>
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
                  {conversionTargets.slice(0, 8).map(c => (
                    <div key={c.code} className={styles.currencyRow}>
                      <span>{c.flag}</span>
                      <span>{c.code}</span>
                      <span style={{marginLeft: 'auto', fontWeight: 600}}>{formatConverted(meetingCostInRub, c)}</span>
                    </div>
                  ))}
                </div>
              )}
            </span>
          </InfoRow>
          )
        })()}
        {event.description && (
          <div className={styles.descBlock}>
            <span className={styles.descLabel}>{t('descLabel')}</span>
            <p className={styles.descText}>{event.description}</p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {paymentDue && event.studentId && onViewPayment && (
          <button
            className={styles.btnSecondary}
            style={{background: '#2563EB', color: '#fff', borderColor: '#2563EB'}}
            onClick={() => onViewPayment(event.studentId!)}
          >
            {t('paymentDueBtn')}
          </button>
        )}
        {event.warning && onConfirm && (
          <button
            className={styles.btnSecondary}
            style={{background: '#10B981', color: '#fff', borderColor: '#10B981'}}
            onClick={() => { onConfirm(event.id); onClose() }}
          >
            ✓ Подтвердить
          </button>
        )}
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
