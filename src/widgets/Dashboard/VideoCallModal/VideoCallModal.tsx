'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import styles from './VideoCallModal.module.scss'

interface Category {
  id: string
  name: string
}

interface MyStudent {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface Props {
  defaultName: string
  onClose: () => void
}

type Step = 'name' | 'details'
type AccessType = 'ALL' | 'MY_STUDENTS' | 'SELECTED'

const ACCESS_LABELS: Record<AccessType, string> = {
  ALL: 'Все',
  MY_STUDENTS: 'Мои ученики',
  SELECTED: 'По списку',
}

export function VideoCallModal({ defaultName, onClose }: Props) {
  const router = useRouter()

  // Step 1
  const [roomName, setRoomName] = useState(defaultName || '')
  const [checking, setChecking] = useState(false)
  const [step1Error, setStep1Error] = useState<string | null>(null)

  // Step 2
  const [step, setStep] = useState<Step>('name')
  const [isEnded, setIsEnded] = useState(false)
  const [topic, setTopic] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [accessType, setAccessType] = useState<AccessType>('ALL')
  const [myStudents, setMyStudents] = useState<MyStudent[]>([])
  const [checkedStudents, setCheckedStudents] = useState<Set<string>>(new Set())
  const [extraEmails, setExtraEmails] = useState('')
  const [creating, setCreating] = useState(false)
  const [step2Error, setStep2Error] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (step !== 'details') return
    if (categories.length === 0) {
      fetch('/api/categories?langCode=ru')
        .then(r => r.json())
        .then((d: Category[]) => { if (Array.isArray(d)) setCategories(d) })
        .catch(() => {})
    }
    if (myStudents.length === 0) {
      fetch('/api/call/my-students')
        .then(r => r.json())
        .then(d => { if (Array.isArray(d.students)) setMyStudents(d.students) })
        .catch(() => {})
    }
  }, [step, categories.length, myStudents.length])

  const toggleStudent = (email: string) => {
    setCheckedStudents(prev => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = roomName.trim()
    if (!name) return
    setChecking(true)
    setStep1Error(null)
    try {
      const res = await fetch(`/api/call/rooms?name=${encodeURIComponent(name)}`)
      const data = await res.json()
      if (data.status === 'active') {
        if (data.hasAccess) {
          router.push(`/call/${data.id}`)
        } else {
          setStep1Error('Нет доступа к этой комнате')
        }
      } else if (data.status === 'ended') {
        setIsEnded(true)
        setTopic(name)
        setStep('details')
      } else {
        setTopic(name)
        setIsEnded(false)
        setStep('details')
      }
    } catch {
      setStep1Error('Ошибка соединения')
    } finally {
      setChecking(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setStep2Error(null)
    const typedEmails = extraEmails
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean)
    const allEmails = accessType === 'SELECTED'
      ? [...Array.from(checkedStudents), ...typedEmails]
      : []
    try {
      const res = await fetch('/api/call/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomName.trim(),
          topic: topic.trim() || roomName.trim(),
          categoryId: categoryId || undefined,
          accessType,
          allowedEmails: allEmails,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setStep2Error(data.error === 'no_access' ? 'Нет доступа к этой комнате' : (data.error ?? 'Ошибка'))
      } else {
        router.push(`/call/${data.id}`)
      }
    } catch {
      setStep2Error('Ошибка соединения')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={styles.icon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
            <rect x="1" y="6" width="14" height="12" rx="2" />
          </svg>
        </div>

        {/* ── Step 1 ── */}
        {step === 'name' && (
          <>
            <h2 className={styles.title}>Видеозвонок</h2>
            <p className={styles.subtitle}>Введите название комнаты, чтобы войти или создать</p>
            <form onSubmit={handleCheck} className={styles.form}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                placeholder="Название комнаты"
                value={roomName}
                onChange={e => { setRoomName(e.target.value); setStep1Error(null) }}
                disabled={checking}
              />
              {step1Error && <p className={styles.error}>{step1Error}</p>}
              <button type="submit" className={styles.submitBtn} disabled={checking || !roomName.trim()}>
                {checking ? 'Проверка...' : 'Продолжить'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 'details' && (
          <>
            <h2 className={styles.title}>{isEnded ? 'Создать новую комнату' : 'Настройки комнаты'}</h2>
            <p className={styles.subtitle}>
              {isEnded
                ? `Комната «${roomName}» завершена — создайте новую`
                : `Новая комната «${roomName}»`}
            </p>
            <form onSubmit={handleCreate} className={styles.form}>
              <button type="button" className={styles.backBtn} onClick={() => { setStep('name'); setStep2Error(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Назад
              </button>

              <div className={styles.divider} />

              <span className={styles.fieldLabel}>Тема встречи</span>
              <input
                className={styles.input}
                type="text"
                placeholder="О чём встреча?"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                disabled={creating}
              />

              <span className={styles.fieldLabel}>Предмет</span>
              <select
                className={styles.select}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                disabled={creating}
              >
                <option value="">Не указан</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <span className={styles.fieldLabel}>Доступ</span>
              <div className={styles.accessRow}>
                {(Object.keys(ACCESS_LABELS) as AccessType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`${styles.accessBtn} ${accessType === type ? styles.accessBtnActive : ''}`}
                    onClick={() => setAccessType(type)}
                    disabled={creating}
                  >
                    {ACCESS_LABELS[type]}
                  </button>
                ))}
              </div>

              {accessType === 'SELECTED' && (
                <div className={styles.selectedPanel}>
                  {myStudents.length > 0 && (
                    <>
                      <span className={styles.selectedLabel}>Мои ученики</span>
                      <div className={styles.studentList}>
                        {myStudents.map(s => (
                          <label key={s.id} className={styles.studentRow}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={checkedStudents.has(s.email)}
                              onChange={() => toggleStudent(s.email)}
                              disabled={creating}
                            />
                            <span className={styles.studentRowName}>{s.name}</span>
                            <span className={styles.studentRowEmail}>{s.email}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                  <span className={styles.selectedLabel}>Другие (email через запятую)</span>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="user@example.com, another@example.com"
                    value={extraEmails}
                    onChange={e => setExtraEmails(e.target.value)}
                    disabled={creating}
                  />
                  {checkedStudents.size > 0 && (
                    <span className={styles.selectedCount}>
                      Выбрано учеников: {checkedStudents.size}
                    </span>
                  )}
                </div>
              )}

              {step2Error && <p className={styles.error}>{step2Error}</p>}
              <button type="submit" className={styles.submitBtn} disabled={creating}>
                {creating ? 'Создание...' : 'Создать и войти'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
