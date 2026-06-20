'use client'

import { CreateServiceModal } from '@/widgets/Dashboard/CreateServiceModal/CreateServiceModal'
import {getDisplayName} from '@/shared/utils/transliterate'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import styles from './StudentDetailModal.module.scss'

interface ErrorItem {
  id: string
  createdAt: string
  description: string | null
  fragment: string | null
  isCorrection: boolean
  categories: { id: string; name: string }[]
}

interface Meeting {
  id: string
  title: string
  scheduledAt: string | null
  roomName: string
}

interface StudentData {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface ServiceOption {
  id: string
  title: string
  price: number
  duration: number
}

interface Props {
  studentId: string
  studentName: string
  studentNameTransliterated?: string | null
  studentInitials: string
  avatarColor: string
  avatarTextColor: string
  subject: string
  teacherId?: string
  onClose: () => void
}

type Tab = 'meetings' | 'errors' | 'schedule'

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function localDatetimeToISO(value: string): string {
  return new Date(value).toISOString()
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function minDatetime() {
  return toLocalDatetime(new Date().toISOString())
}

export function StudentDetailModal({
  studentId, studentName, studentNameTransliterated, studentInitials, avatarColor, avatarTextColor, subject, teacherId, onClose,
}: Props) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const displayName = getDisplayName(studentName, locale, studentNameTransliterated)
  const [tab, setTab] = useState<Tab>('meetings')
  const [offerOpen, setOfferOpen] = useState(false)
  const [student, setStudent] = useState<StudentData | null>(null)
  const [errors, setErrors] = useState<ErrorItem[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<ServiceOption[]>([])

  const [schedTitle, setSchedTitle] = useState(t('sdmDefaultTitle', { name: displayName }))
  const [schedAt, setSchedAt] = useState('')
  const [schedDuration, setSchedDuration] = useState(60)
  const [schedServiceId, setSchedServiceId] = useState('')
  const [schedLoading, setSchedLoading] = useState(false)
  const [schedError, setSchedError] = useState<string | null>(null)
  const [schedConflict, setSchedConflict] = useState<{ title: string; scheduledAt: string } | null>(null)
  const [schedSuccess, setSchedSuccess] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    fetch(`/api/teacher/student-detail?studentId=${studentId}`)
      .then(r => r.json())
      .then(data => {
        if (data.student) setStudent(data.student)
        if (Array.isArray(data.errors)) setErrors(data.errors)
        if (Array.isArray(data.meetings)) setMeetings(data.meetings)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId])

  useEffect(() => {
    if (!teacherId) return
    fetch(`/api/services?teacherId=${teacherId}&lang=${locale}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.services)) setServices(d.services) })
      .catch(() => {})
  }, [teacherId])

  const deleteError = async (errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId))
    await fetch(`/api/teacher/student-detail?errorId=${errorId}`, { method: 'DELETE' })
  }

  const cancelMeeting = async (conferenceId: string) => {
    setMeetings(prev => prev.filter(m => m.id !== conferenceId))
    await fetch(`/api/teacher/schedule-meeting?conferenceId=${conferenceId}`, { method: 'DELETE' })
  }

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schedAt) return
    setSchedLoading(true)
    setSchedError(null)
    setSchedConflict(null)
    const tid = toast.loading(t('sdmSchedulingToast'))
    try {
      const res = await fetch('/api/teacher/schedule-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, title: schedTitle, scheduledAt: localDatetimeToISO(schedAt), durationMinutes: schedDuration, ...(schedServiceId ? { serviceId: schedServiceId } : {}) }),
      })
      const data = await res.json()
      if (res.status === 409 && data.conflict) {
        setSchedConflict(data.conflict)
        toast.error(t('sdmConflictToast'), { id: tid })
      } else if (!res.ok || data.error) {
        const msg = data.error ?? t('sdmErrorFallback')
        setSchedError(msg)
        toast.error(msg, { id: tid })
      } else {
        toast.success(t('sdmSuccessToast'), { id: tid })
        setSchedSuccess(true)
        setMeetings(prev => [
          ...prev,
          { id: data.id, title: schedTitle, scheduledAt: localDatetimeToISO(schedAt), roomName: data.roomName },
        ].sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime()))
        setSchedTitle(t('sdmDefaultTitle', { name: displayName }))
        setSchedAt('')
        setTimeout(() => setSchedSuccess(false), 3000)
      }
    } catch {
      setSchedError(t('sdmConnectionError'))
      toast.error(t('sdmConnectionToast'), { id: tid })
    } finally {
      setSchedLoading(false)
    }
  }

  return (
    <>
    {teacherId && (
      <CreateServiceModal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        teacherId={teacherId}
        onCreated={() => {}}
        initialStudentId={studentId}
        initialIsPersonal
      />
    )}
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} ref={modalRef}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.studentInfo}>
            <div className={styles.avatar} style={{ background: avatarColor, color: avatarTextColor }}>
              {studentInitials}
            </div>
            <div>
              <div className={styles.studentName}>{displayName}</div>
              {subject && <div className={styles.studentSubject}>{subject}</div>}
              {student?.email && <div className={styles.studentEmail}>{student.email}</div>}
            </div>
          </div>
          <div className={styles.headerActions}>
            {teacherId && (
              <button className={styles.offerBtn} onClick={() => setOfferOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 12V22H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" />
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
                {t('sdmOfferBtn')}
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'meetings' ? styles.tabActive : ''}`} onClick={() => setTab('meetings')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {t('sdmTabMeetings')} {meetings.length > 0 && <span className={styles.tabBadge}>{meetings.length}</span>}
          </button>
          <button className={`${styles.tab} ${tab === 'errors' ? styles.tabActive : ''}`} onClick={() => setTab('errors')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {t('sdmTabErrors')} {errors.length > 0 && <span className={styles.tabBadge}>{errors.length}</span>}
          </button>
          <button className={`${styles.tab} ${tab === 'schedule' ? styles.tabActive : ''}`} onClick={() => setTab('schedule')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {t('sdmTabSchedule')}
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading && <div className={styles.loading}>{t('sdmLoading')}</div>}

          {/* Meetings tab */}
          {!loading && tab === 'meetings' && (
            <div className={styles.section}>
              {meetings.length === 0 ? (
                <div className={styles.empty}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span>{t('sdmNoMeetings')}</span>
                </div>
              ) : (
                <div className={styles.meetingList}>
                  {meetings.map(m => (
                    <div key={m.id} className={styles.meetingCard}>
                      <div className={styles.meetingIcon}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                      </div>
                      <div className={styles.meetingInfo}>
                        <div className={styles.meetingTitle}>{m.title}</div>
                        {m.scheduledAt && <div className={styles.meetingTime}>{formatDateShort(m.scheduledAt)}</div>}
                      </div>
                      <button className={styles.cancelBtn} title={t('sdmCancelTitle')} onClick={() => cancelMeeting(m.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button className={styles.scheduleLink} onClick={() => setTab('schedule')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('sdmScheduleMeetingBtn')}
              </button>
            </div>
          )}

          {/* Errors tab */}
          {!loading && tab === 'errors' && (
            <div className={styles.section}>
              {errors.length === 0 ? (
                <div className={styles.empty}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>{t('sdmNoErrors')}</span>
                </div>
              ) : (
                <div className={styles.errorList}>
                  {errors.map(err => (
                    <div key={err.id} className={`${styles.errorCard} ${err.isCorrection ? styles.errorCardFixed : ''}`}>
                      <div className={styles.errorMeta}>
                        <span className={styles.errorDate}>{formatDate(err.createdAt)}</span>
                        {err.isCorrection && <span className={styles.fixedBadge}>{t('sdmFixedBadge')}</span>}
                      </div>
                      {err.fragment && <div className={styles.errorFragment}>{err.fragment}</div>}
                      {err.description && <div className={styles.errorDesc}>{err.description}</div>}
                      {err.categories.length > 0 && (
                        <div className={styles.catRow}>
                          {err.categories.map(c => (
                            <span key={c.id} className={styles.catTag}>{c.name}</span>
                          ))}
                        </div>
                      )}
                      <button className={styles.deleteErrBtn} onClick={() => deleteError(err.id)} title={t('sdmDeleteTitle')}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schedule tab */}
          {!loading && tab === 'schedule' && (
            <div className={styles.section}>
              {schedSuccess && (
                <div className={styles.successBanner}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  {t('sdmScheduledSuccess')}
                </div>
              )}
              <form className={styles.schedForm} onSubmit={submitSchedule}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>{t('sdmFormTitleLabel')}</label>
                  <input
                    className={styles.formInput}
                    value={schedTitle}
                    onChange={e => setSchedTitle(e.target.value)}
                    placeholder={t('sdmFormTitlePlaceholder')}
                    required
                    disabled={schedLoading}
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>{t('sdmFormDateLabel')}</label>
                  <input
                    className={styles.formInput}
                    type="datetime-local"
                    value={schedAt}
                    min={minDatetime()}
                    onChange={e => { setSchedAt(e.target.value); setSchedConflict(null); setSchedError(null) }}
                    required
                    disabled={schedLoading}
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>{t('sdmFormDurationLabel')}</label>
                  <div className={styles.durationRow}>
                    {[30, 45, 60, 90, 120].map(min => (
                      <button
                        key={min}
                        type="button"
                        className={`${styles.durationBtn} ${schedDuration === min ? styles.durationBtnActive : ''}`}
                        onClick={() => setSchedDuration(min)}
                        disabled={schedLoading}
                      >
                        {min < 60 ? `${min} ${t('sdmDurationMin')}` : `${min / 60} ${t('sdmDurationH')}`}
                      </button>
                    ))}
                  </div>
                </div>

                {services.length > 0 && (
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>{t('sdmFormServiceLabel')}</label>
                    <select
                      className={styles.formInput}
                      value={schedServiceId}
                      onChange={e => setSchedServiceId(e.target.value)}
                      disabled={schedLoading}
                    >
                      <option value=''>{t('sdmFormServiceNone')}</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.title} — {s.price.toLocaleString()} ₽ / {s.duration} {t('sdmDurationMin')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {schedConflict && (
                  <div className={styles.conflictBanner}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      {t('sdmConflictMsg', {
                        title: schedConflict.title,
                        time: schedConflict.scheduledAt ? t('sdmConflictAt', { time: formatDate(schedConflict.scheduledAt) }) : '',
                      })}
                    </span>
                  </div>
                )}

                {schedError && !schedConflict && (
                  <div className={styles.errorBanner}>{schedError}</div>
                )}

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={schedLoading || !schedTitle.trim() || !schedAt}
                >
                  {schedLoading ? t('sdmSubmitLoading') : t('sdmSubmitBtn')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
