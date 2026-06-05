'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import styles from './BookingResponseModal.module.scss'

export interface BookingInfo {
  id: string
  studentName: string
  serviceName: string
  desiredDate: string
  desiredTime: string
  finalPrice: number
}

interface Props {
  open: boolean
  onClose: () => void
  booking: BookingInfo | null
}

function IconCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

type Phase = 'main' | 'reschedule' | 'cancelConfirm' | 'success'
type SuccessAction = 'confirm' | 'reschedule' | 'cancel'

export function BookingResponseModal({ open, onClose, booking }: Props) {
  const t = useTranslations('dashboard.bookingResponse')
  const [phase, setPhase] = useState<Phase>('main')
  const [successAction, setSuccessAction] = useState<SuccessAction>('confirm')
  const [confirmedDate, setConfirmedDate] = useState('')
  const [confirmedTime, setConfirmedTime] = useState('')
  const [dateError, setDateError] = useState('')
  const [timeError, setTimeError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setPhase('main')
      setConfirmedDate('')
      setConfirmedTime('')
      setDateError('')
      setTimeError('')
      setError('')
      setSubmitting(false)
    }
  }, [open])

  if (!open || !booking) return null

  async function sendAction(action: 'confirm' | 'reschedule' | 'cancel', extra?: { confirmedDate: string; confirmedTime: string }) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/bookings/${booking!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error')
        return
      }
      setSuccessAction(action)
      setPhase('success')
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleConfirm() {
    sendAction('confirm')
  }

  function handleRescheduleSubmit() {
    let valid = true
    if (!confirmedDate) { setDateError(t('newDateLabel')); valid = false } else { setDateError('') }
    if (!confirmedTime) { setTimeError(t('newTimeLabel')); valid = false } else { setTimeError('') }
    if (!valid) return
    sendAction('reschedule', { confirmedDate, confirmedTime })
  }

  function handleCancelConfirm() {
    sendAction('cancel')
  }

  const successText =
    successAction === 'confirm'
      ? t('successConfirm')
      : successAction === 'reschedule'
        ? t('successReschedule')
        : t('successCancel')

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <h2 className={styles.heading}>{t('heading')}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('close')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {phase === 'success' ? (
          <div className={styles.successWrap}>
            <div className={styles.successIcon}><IconCheck /></div>
            <h3 className={styles.successTitle}>{successText}</h3>
            <button className={styles.doneBtn} onClick={onClose}>{t('done')}</button>
          </div>
        ) : (
          <>
            <div className={styles.body}>
              <div className={styles.infoCard}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('studentLabel')}</span>
                  <span className={styles.infoValue}>{booking.studentName}</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('serviceLabel')}</span>
                  <span className={styles.infoValue}>{booking.serviceName}</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('desiredDate')}</span>
                  <span className={styles.infoValue}>{booking.desiredDate || '—'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('desiredTime')}</span>
                  <span className={styles.infoValue}>{booking.desiredTime || '—'}</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('price')}</span>
                  <span className={styles.infoValue}>{booking.finalPrice.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>

              {phase === 'reschedule' && (
                <div className={styles.rescheduleSection}>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('newDateLabel')}</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={confirmedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => { setConfirmedDate(e.target.value); setDateError('') }}
                    />
                    {dateError && <div className={styles.error}>{dateError}</div>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('newTimeLabel')}</label>
                    <input
                      className={styles.input}
                      type="time"
                      value={confirmedTime}
                      onChange={e => { setConfirmedTime(e.target.value); setTimeError('') }}
                    />
                    {timeError && <div className={styles.error}>{timeError}</div>}
                  </div>
                </div>
              )}

              {phase === 'cancelConfirm' && (
                <div className={styles.cancelConfirm}>
                  {t('cancelConfirm')}
                </div>
              )}

              {error && <div className={styles.error}>{error}</div>}
            </div>

            <div className={styles.footer}>
              {phase === 'main' && (
                <>
                  <button className={styles.confirmBtn} onClick={handleConfirm} disabled={submitting}>
                    {submitting ? t('confirming') : t('confirm')}
                  </button>
                  <button className={styles.rescheduleBtn} onClick={() => setPhase('reschedule')} disabled={submitting}>
                    {t('reschedule')}
                  </button>
                  <button className={styles.cancelBtn} onClick={() => setPhase('cancelConfirm')} disabled={submitting}>
                    {t('cancel')}
                  </button>
                </>
              )}

              {phase === 'reschedule' && (
                <>
                  <button className={styles.confirmBtn} onClick={handleRescheduleSubmit} disabled={submitting}>
                    {submitting ? t('confirming') : t('reschedule')}
                  </button>
                  <button className={styles.rescheduleBtn} onClick={() => setPhase('main')} disabled={submitting}>
                    {t('cancelNo')}
                  </button>
                </>
              )}

              {phase === 'cancelConfirm' && (
                <>
                  <button className={styles.cancelYesBtn} onClick={handleCancelConfirm} disabled={submitting}>
                    {submitting ? t('confirming') : t('cancelYes')}
                  </button>
                  <button className={styles.cancelNoBtn} onClick={() => setPhase('main')} disabled={submitting}>
                    {t('cancelNo')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
