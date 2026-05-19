'use client'

import {useState, useEffect} from 'react'
import {CalendarEvent, CalendarEventColor} from '@/shared/types/Calendar/calendar.types'
import {EVENT_COLORS, formatDateKey} from '@/shared/helpers/calendar/calendar.helpers'
import {useTranslations} from 'next-intl'
import styles from './CalendarCreateModal.module.scss'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'

interface ServiceOption {
  id: string
  title: string
  price: number
  duration: number
}

interface CalendarCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: Omit<CalendarEvent, 'id'> & {id?: string}) => void
  initialDate?: string | null
  initialStartTime?: string | null
  initialEndTime?: string | null
  editingEvent?: CalendarEvent | null
  teacherServices?: ServiceOption[]
}

const COLOR_OPTIONS = Object.keys(EVENT_COLORS) as CalendarEventColor[]

const EMPTY_FORM = {
  title: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  studentName: '',
  subject: '',
  description: '',
  status: 'scheduled' as CalendarEvent['status'],
  color: 'purple' as CalendarEventColor
}

export function CalendarCreateModal({
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialStartTime,
  initialEndTime,
  editingEvent,
  teacherServices,
}: CalendarCreateModalProps) {
  const t = useTranslations('calendar.createModal')
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedServiceId, setSelectedServiceId] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (editingEvent) {
      setForm({
        title: editingEvent.title,
        date: editingEvent.date,
        startTime: editingEvent.startTime,
        endTime: editingEvent.endTime,
        studentName: editingEvent.studentName ?? '',
        subject: editingEvent.subject ?? '',
        description: editingEvent.description ?? '',
        status: editingEvent.status ?? 'scheduled',
        color: editingEvent.color
      })
      setSelectedServiceId(editingEvent.serviceId ?? '')
    } else {
      setForm({
        ...EMPTY_FORM,
        date: initialDate ?? formatDateKey(new Date()),
        startTime: initialStartTime ?? '09:00',
        endTime: initialEndTime ?? '10:00'
      })
      setSelectedServiceId('')
    }
  }, [isOpen, editingEvent, initialDate, initialStartTime, initialEndTime])

  const set =
    (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({...prev, [key]: e.target.value}))

  const handleSave = () => {
    if (!form.title.trim()) {
      document.getElementById('ce-title')?.focus()
      return
    }
    const svc = teacherServices?.find(s => s.id === selectedServiceId)
    onSave({
      ...(editingEvent ? {id: editingEvent.id} : {}),
      title: form.title.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      color: form.color,
      status: form.status,
      studentName: form.studentName.trim() || undefined,
      subject: form.subject.trim() || undefined,
      description: form.description.trim() || undefined,
      ...(svc ? {
        serviceId: svc.id,
        serviceTitle: svc.title,
        servicePrice: svc.price,
        serviceDurationMinutes: svc.duration,
      } : {}),
    })
  }

  const isEditing = !!editingEvent

  return (
    <ModalWindowDefault isOpen={isOpen} onClose={onClose}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.eyebrow}>{isEditing ? t('editEvent') : t('newEvent')}</div>
          <div className={styles.title}>{isEditing ? t('editTitle') : t('createTitle')}</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
            <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>{t('titleLabel')}</label>
          <input
            id='ce-title'
            className={styles.input}
            type='text'
            placeholder={t('titlePlaceholder')}
            value={form.title}
            onChange={set('title')}
            autoFocus
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>{t('dateLabel')}</label>
            <input className={styles.input} type='date' value={form.date} onChange={set('date')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('studentLabel')}</label>
            <input
              className={styles.input}
              type='text'
              placeholder={t('studentPlaceholder')}
              value={form.studentName}
              onChange={set('studentName')}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>{t('startLabel')}</label>
            <input className={styles.input} type='time' value={form.startTime} onChange={set('startTime')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('endLabel')}</label>
            <input className={styles.input} type='time' value={form.endTime} onChange={set('endTime')} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>{t('subjectLabel')}</label>
            <input
              className={styles.input}
              type='text'
              placeholder={t('subjectPlaceholder')}
              value={form.subject}
              onChange={set('subject')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('statusLabel')}</label>
            <select className={styles.input} value={form.status} onChange={set('status')}>
              <option value='scheduled'>{t('statusScheduled')}</option>
              <option value='completed'>{t('statusCompleted')}</option>
              <option value='cancelled'>{t('statusCancelled')}</option>
            </select>
          </div>
        </div>

        {teacherServices && teacherServices.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>{t('serviceLabel')}</label>
            <select
              className={styles.input}
              value={selectedServiceId}
              onChange={e => setSelectedServiceId(e.target.value)}
            >
              <option value=''>{t('noService')}</option>
              {teacherServices.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} — {s.price.toLocaleString()} ₽ / {s.duration} мин
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>{t('colorLabel')}</label>
          <div className={styles.colorPicker}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type='button'
                className={`${styles.colorDot} ${form.color === c ? styles.colorDotSelected : ''}`}
                style={{background: EVENT_COLORS[c].border}}
                onClick={() => setForm((prev) => ({...prev, color: c}))}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t('descLabel')}</label>
          <textarea
            className={styles.textarea}
            placeholder={t('descPlaceholder')}
            value={form.description}
            onChange={set('description')}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.btnSecondary} onClick={onClose}>
          {t('cancel')}
        </button>
        <button className={styles.btnPrimary} onClick={handleSave}>
          {isEditing ? t('save') : t('create')}
        </button>
      </div>
    </ModalWindowDefault>
  )
}
