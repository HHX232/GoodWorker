'use client'

import {useState, useEffect} from 'react'
import {CalendarEvent, CalendarEventColor} from '@/shared/types/Calendar/calendar.types'
import {EVENT_COLORS, formatDateKey} from '@/shared/helpers/calendar/calendar.helpers'
import styles from './CalendarCreateModal.module.scss'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'

interface CalendarCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: Omit<CalendarEvent, 'id'> & {id?: string}) => void
  initialDate?: string | null
  initialStartTime?: string | null
  initialEndTime?: string | null
  editingEvent?: CalendarEvent | null
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
  editingEvent
}: CalendarCreateModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)

  // Fill form when modal opens
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
    } else {
      setForm({
        ...EMPTY_FORM,
        date: initialDate ?? formatDateKey(new Date()),
        startTime: initialStartTime ?? '09:00',
        endTime: initialEndTime ?? '10:00'
      })
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
      description: form.description.trim() || undefined
    })
  }

  const isEditing = !!editingEvent

  return (
    <ModalWindowDefault isOpen={isOpen} onClose={onClose}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.eyebrow}>{isEditing ? 'Редактировать' : 'Новое событие'}</div>
          <div className={styles.title}>{isEditing ? 'Изменить запись' : 'Создать запись'}</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
            <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        {/* Title */}
        <div className={styles.field}>
          <label className={styles.label}>Название</label>
          <input
            id='ce-title'
            className={styles.input}
            type='text'
            placeholder='Алгебра, Физика, Созвон…'
            value={form.title}
            onChange={set('title')}
            autoFocus
          />
        </div>

        {/* Date + Student */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Дата</label>
            <input className={styles.input} type='date' value={form.date} onChange={set('date')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Ученик</label>
            <input
              className={styles.input}
              type='text'
              placeholder='Имя ученика'
              value={form.studentName}
              onChange={set('studentName')}
            />
          </div>
        </div>

        {/* Start + End */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Начало</label>
            <input className={styles.input} type='time' value={form.startTime} onChange={set('startTime')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Конец</label>
            <input className={styles.input} type='time' value={form.endTime} onChange={set('endTime')} />
          </div>
        </div>

        {/* Subject + Status */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Предмет</label>
            <input
              className={styles.input}
              type='text'
              placeholder='Математика…'
              value={form.subject}
              onChange={set('subject')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Статус</label>
            <select className={styles.input} value={form.status} onChange={set('status')}>
              <option value='scheduled'>Запланировано</option>
              <option value='completed'>Проведено</option>
              <option value='cancelled'>Отменено</option>
            </select>
          </div>
        </div>

        {/* Color */}
        <div className={styles.field}>
          <label className={styles.label}>Цвет</label>
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

        {/* Description */}
        <div className={styles.field}>
          <label className={styles.label}>Описание</label>
          <textarea
            className={styles.textarea}
            placeholder='Заметки к занятию…'
            value={form.description}
            onChange={set('description')}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.btnSecondary} onClick={onClose}>
          Отмена
        </button>
        <button className={styles.btnPrimary} onClick={handleSave}>
          {isEditing ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </ModalWindowDefault>
  )
}
