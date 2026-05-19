'use client'

import {CalendarTask} from '@/shared/types/Calendar/calendar.types'
import {useTranslations} from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {nanoid} from 'nanoid'
import {useState} from 'react'
import styles from './CalendarTaskCreateModal.module.scss'

interface CalendarTaskCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (task: Omit<CalendarTask, 'id'>) => void
  editingTask?: CalendarTask | null
}

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

const EMPTY_FORM = {
  title: '',
  description: '',
  dueDate: '',
  category: '',
  priority: 'medium' as CalendarTask['priority']
}

export function CalendarTaskCreateModal({isOpen, onClose, onSave, editingTask}: CalendarTaskCreateModalProps) {
  const t = useTranslations('calendar.taskCreateModal')
  const [form, setForm] = useState(EMPTY_FORM)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [newItemText, setNewItemText] = useState('')

  const set =
    (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({...prev, [key]: e.target.value}))

  const addItem = () => {
    const text = newItemText.trim()
    if (!text) return
    setItems((prev) => [...prev, {id: nanoid(), text, completed: false}])
    setNewItemText('')
  }

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? {...item, completed: !item.completed} : item)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateItemText = (id: string, text: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? {...item, text} : item)))
  }

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    }
  }

  const handleSave = () => {
    if (!form.title.trim()) {
      document.getElementById('ct-title')?.focus()
      return
    }
    onSave({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate || undefined,
      category: form.category.trim() || undefined,
      priority: form.priority,
      completed: false,
      checklistItems: items.length > 0 ? items : undefined
    })
    setForm(EMPTY_FORM)
    setItems([])
    setNewItemText('')
  }

  const completedCount = items.filter((i) => i.completed).length
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0

  const footer = (
    <div className={styles.footer}>
      <button className={styles.btnSecondary} onClick={onClose}>
        {t('cancel')}
      </button>
      <button className={styles.btnPrimary} onClick={handleSave}>
        {editingTask ? t('save') : t('create')}
      </button>
    </div>
  )

  return (
    <ModalWindowDefault isOpen={isOpen} onClose={onClose} modalFooter={footer}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>{editingTask ? t('editTask') : t('newTask')}</div>
        <div className={styles.title}>{editingTask ? t('editTitle') : t('createTitle')}</div>
      </div>

      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>{t('titleLabel')}</label>
          <input
            id='ct-title'
            className={styles.input}
            type='text'
            placeholder={t('titlePlaceholder')}
            value={form.title}
            onChange={set('title')}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t('descLabel')}</label>
          <textarea
            className={styles.textarea}
            placeholder={t('descPlaceholder')}
            value={form.description}
            onChange={set('description')}
            rows={2}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>{t('dueDateLabel')}</label>
            <input className={styles.input} type='date' value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('categoryLabel')}</label>
            <input
              className={styles.input}
              type='text'
              placeholder={t('categoryPlaceholder')}
              value={form.category}
              onChange={set('category')}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t('priorityLabel')}</label>
          <div className={styles.priorityGroup}>
            {(['low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type='button'
                className={`${styles.priorityBtn} ${form.priority === p ? styles.priorityBtnActive : ''} ${
                  styles[`priority_${p}`]
                }`}
                onClick={() => setForm((prev) => ({...prev, priority: p}))}
              >
                {t(p as 'low' | 'medium' | 'high')}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.checklistHeader}>
            <label className={styles.label}>{t('checklistLabel')}</label>
            {items.length > 0 && (
              <span className={styles.checklistProgress}>
                {completedCount}/{items.length}
              </span>
            )}
          </div>

          {/* Прогресс-бар */}
          {items.length > 0 && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{width: `${progress}%`}} />
            </div>
          )}

          {/* Список пунктов */}
          {items.length > 0 && (
            <ul className={styles.checklistItems}>
              {items.map((item) => (
                <li key={item.id} className={styles.checklistItem}>
                  <button
                    type='button'
                    className={`${styles.checklistCheck} ${item.completed ? styles.checklistCheckDone : ''}`}
                    onClick={() => toggleItem(item.id)}
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
                    onChange={(e) => updateItemText(item.id, e.target.value)}
                  />
                  <button
                    type='button'
                    className={styles.checklistRemove}
                    onClick={() => removeItem(item.id)}
                    aria-label={t('removeItem')}
                  >
                    <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
                      <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Добавление нового пункта */}
          <div className={styles.checklistAdd}>
            <div className={styles.checklistAddDot} />
            <input
              className={styles.checklistAddInput}
              placeholder={t('checklistPlaceholder')}
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={handleItemKeyDown}
            />
            {newItemText.trim() && (
              <button type='button' className={styles.checklistAddBtn} onClick={addItem}>
                <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
                  <path d='M12 5v14M5 12h14' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalWindowDefault>
  )
}
