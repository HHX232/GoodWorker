'use client'

import {formatDateRu} from '@/shared/helpers/calendar/calendar.helpers'
import {CalendarTask} from '@/shared/types/Calendar/calendar.types'
import {useLocale, useTranslations} from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {nanoid} from 'nanoid'
import {useEffect, useState} from 'react'
import styles from './CalendarTaskModal.module.scss'

interface CalendarTaskModalProps {
  task: CalendarTask | null
  onClose: () => void
  onToggle: (taskId: string) => void
  onSave: (task: CalendarTask) => void
}

export function CalendarTaskModal({task, onClose, onToggle, onSave}: CalendarTaskModalProps) {
  const t = useTranslations('calendar.taskModal')
  const locale = useLocale()
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'

  const PRIORITY_MAP = {
    low: {label: t('priorityLow'), bg: '#EAF3DE', color: '#3B6D11'},
    medium: {label: t('priorityMedium'), bg: '#FAEEDA', color: '#633806'},
    high: {label: t('priorityHigh'), bg: '#FCEBEB', color: '#A32D2D'}
  }

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<CalendarTask | null>(null)
  const [newItemText, setNewItemText] = useState('')

  // Сбрасываем режим редактирования при смене таска
  useEffect(() => {
    setIsEditing(false)
    setForm(null)
    setNewItemText('')
  }, [task?.id])

  if (!task) return null

  const priority = task.priority ? PRIORITY_MAP[task.priority] : null

  // ── Helpers редактирования ──────────────────────────

  const startEdit = () => setForm({...task, checklistItems: task.checklistItems ? [...task.checklistItems] : []})
  const cancelEdit = () => {
    setIsEditing(false)
    setForm(null)
  }

  const setField = <K extends keyof CalendarTask>(key: K, value: CalendarTask[K]) =>
    setForm((prev) => (prev ? {...prev, [key]: value} : prev))

  const addCheckItem = () => {
    const text = newItemText.trim()
    if (!text || !form) return
    setForm({...form, checklistItems: [...(form.checklistItems ?? []), {id: nanoid(), text, completed: false}]})
    setNewItemText('')
  }

  const toggleCheckItem = (id: string) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems?.map((i) => (i.id === id ? {...i, completed: !i.completed} : i))
          }
        : prev
    )

  const removeCheckItem = (id: string) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems?.filter((i) => i.id !== id)
          }
        : prev
    )

  const handleSave = () => {
    if (!form?.title.trim()) return
    onSave({...form, title: form.title.trim()})
    setIsEditing(false)
    setForm(null)
  }

  // ── Footer ──────────────────────────────────────────

  const viewFooter = (
    <div className={styles.footer}>
      <button className={styles.btnSecondary} onClick={onClose}>
        {t('close')}
      </button>
      <button
        className={styles.editBtn}
        onClick={() => {
          startEdit()
          setIsEditing(true)
        }}
      >
        <PencilIcon />
        {t('edit')}
      </button>
      <button
        className={`${styles.toggleBtn} ${task.completed ? styles.toggleBtnDone : ''}`}
        onClick={() => onToggle(task.id)}
      >
        <CheckCircleIcon />
        {task.completed ? t('unmarkDone') : t('markDone')}
      </button>
    </div>
  )

  const editFooter = (
    <div className={styles.footer}>
      <button className={styles.btnSecondary} onClick={cancelEdit}>
        {t('cancel')}
      </button>
      <button className={styles.btnPrimary} onClick={handleSave}>
        {t('save')}
      </button>
    </div>
  )

  // ── View mode ───────────────────────────────────────

  const viewContent = (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.eyebrow}>{t('taskLabel')}</div>
          <div className={styles.title}>{task.title}</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
            <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        {task.description && <p className={styles.desc}>{task.description}</p>}

        <div className={styles.metaGrid}>
          {task.dueDate && (
            <MetaCard icon={<CalIcon />} label={t('dueDateLabel')}>
              {formatDateRu(task.dueDate, intlLocale)}
            </MetaCard>
          )}
          {task.category && (
            <MetaCard icon={<TagIcon />} label={t('categoryLabel')}>
              {task.category}
            </MetaCard>
          )}
          {priority && (
            <MetaCard icon={<FlagIcon />} label={t('priorityLabel')}>
              <span className={styles.pill} style={{background: priority.bg, color: priority.color}}>
                {priority.label}
              </span>
            </MetaCard>
          )}
          <MetaCard icon={<CheckCircleIcon />} label={t('statusLabel')}>
            <span
              className={styles.pill}
              style={
                task.completed ? {background: '#E1F5EE', color: '#085041'} : {background: '#f4f4f7', color: '#666'}
              }
            >
              {task.completed ? t('statusDone') : t('statusInProgress')}
            </span>
          </MetaCard>
        </div>

        {task.checklistItems && task.checklistItems.length > 0 && (
          <div className={styles.checklistView}>
            <span className={styles.checklistViewLabel}>
              {t('checklistLabel')}
              <span className={styles.checklistViewCount}>
                {task.checklistItems.filter((i) => i.completed).length}/{task.checklistItems.length}
              </span>
            </span>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.round(
                    (task.checklistItems.filter((i) => i.completed).length / task.checklistItems.length) * 100
                  )}%`
                }}
              />
            </div>
            {task.checklistItems.map((item) => (
              <div
                key={item.id}
                className={`${styles.checklistViewItem} ${item.completed ? styles.checklistViewItemDone : ''}`}
              >
                <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
                  <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.6' />
                  {item.completed && (
                    <path
                      d='M9 12l2 2 4-4'
                      stroke='currentColor'
                      strokeWidth='1.6'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  )}
                </svg>
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  // ── Edit mode ───────────────────────────────────────

  const editContent = form && (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.eyebrow}>{t('editingLabel')}</div>
          <div className={styles.title}>{t('editTitle')}</div>
        </div>
        <button className={styles.closeBtn} onClick={cancelEdit}>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
            <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('titleLabel')}</label>
          <input
            className={styles.input}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('descLabel')}</label>
          <textarea
            className={styles.textarea}
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => setField('description', e.target.value || undefined)}
          />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('dueDateLabel')}</label>
            <input
              className={styles.input}
              type='date'
              value={form.dueDate ?? ''}
              onChange={(e) => setField('dueDate', e.target.value || undefined)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('categoryLabel')}</label>
            <input
              className={styles.input}
              placeholder={t('categoryLabel')}
              value={form.category ?? ''}
              onChange={(e) => setField('category', e.target.value || undefined)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('priorityLabel')}</label>
          <div className={styles.priorityGroup}>
            {(['low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type='button'
                className={`${styles.priorityBtn} ${form.priority === p ? styles.priorityBtnActive : ''} ${
                  styles[`priority_${p}`]
                }`}
                onClick={() => setField('priority', p)}
              >
                {t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}` as 'priorityLow' | 'priorityMedium' | 'priorityHigh')}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.checklistHeader}>
            <label className={styles.fieldLabel}>{t('checklistLabel')}</label>
            {(form.checklistItems?.length ?? 0) > 0 && (
              <span className={styles.checklistProgress}>
                {form.checklistItems?.filter((i) => i.completed).length}/{form.checklistItems?.length}
              </span>
            )}
          </div>

          {(form.checklistItems?.length ?? 0) > 0 && (
            <ul className={styles.checklistItems}>
              {form.checklistItems?.map((item) => (
                <li key={item.id} className={styles.checklistItem}>
                  <button
                    type='button'
                    className={`${styles.checklistCheck} ${item.completed ? styles.checklistCheckDone : ''}`}
                    onClick={() => toggleCheckItem(item.id)}
                  >
                    {item.completed && (
                      <svg width='8' height='8' viewBox='0 0 12 12' fill='none'>
                        <path
                          d='M2 6l3 3 5-5'
                          stroke='#fff'
                          strokeWidth='1.8'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    )}
                  </button>
                  <input
                    className={`${styles.checklistItemInput} ${item.completed ? styles.checklistItemDone : ''}`}
                    value={item.text}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              checklistItems: prev.checklistItems?.map((i) =>
                                i.id === item.id ? {...i, text: e.target.value} : i
                              )
                            }
                          : prev
                      )
                    }
                  />
                  <button type='button' className={styles.checklistRemove} onClick={() => removeCheckItem(item.id)}>
                    <svg width='10' height='10' viewBox='0 0 24 24' fill='none'>
                      <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.checklistAdd}>
            <div className={styles.checklistAddDot} />
            <input
              className={styles.checklistAddInput}
              placeholder={t('checklistLabel')}
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCheckItem()
                }
              }}
            />
            {newItemText.trim() && (
              <button type='button' className={styles.checklistAddBtn} onClick={addCheckItem}>
                <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
                  <path d='M12 5v14M5 12h14' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <ModalWindowDefault isOpen={!!task} onClose={onClose} modalFooter={isEditing ? editFooter : viewFooter}>
      {isEditing ? editContent : viewContent}
    </ModalWindowDefault>
  )
}

function MetaCard({icon, label, children}: {icon: React.ReactNode; label: string; children: React.ReactNode}) {
  return (
    <div className={styles.metaCard}>
      <div className={styles.metaIcon}>{icon}</div>
      <div className={styles.metaContent}>
        <span className={styles.metaLabel}>{label}</span>
        <span className={styles.metaValue}>{children}</span>
      </div>
    </div>
  )
}

const CalIcon = () => (
  <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
    <rect x='3' y='4' width='18' height='18' rx='2' stroke='currentColor' strokeWidth='1.6' />
    <path d='M16 2v4M8 2v4M3 10h18' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
  </svg>
)
const TagIcon = () => (
  <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
    <path
      d='M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <circle cx='7' cy='7' r='1.5' fill='currentColor' />
  </svg>
)
const FlagIcon = () => (
  <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
    <path
      d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)
const CheckCircleIcon = () => (
  <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
    <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.6' />
    <path d='M9 12l2 2 4-4' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
)
const PencilIcon = () => (
  <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
    <path
      d='M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path
      d='M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)
