'use client'

import { CategorySelect } from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import { ServiceCard } from '@/shared/ui/Service/ServiceCard/ServiceCard'
import { useLocale } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import styles from './CreateServiceModal.module.scss'

interface CategoryOption {
  id: string
  slug: string
  name: string
  translations: { langCode: string; name: string }[]
}

interface Props {
  open: boolean
  onClose: () => void
  teacherId: string
  onCreated: (service: unknown) => void
}

const DURATION_OPTIONS = [
  { label: '30 мин', value: 30 },
  { label: '45 мин', value: 45 },
  { label: '1 ч',   value: 60 },
  { label: '1.5 ч', value: 90 },
  { label: '2 ч',   value: 120 },
  { label: '3 ч',   value: 180 },
]

const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

function randomCode(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  useEffect(() => {
    if (open && listRef.current) {
      const idx = TIME_OPTIONS.indexOf(value)
      if (idx !== -1) {
        const item = listRef.current.children[idx] as HTMLElement
        item?.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [open, value])

  return (
    <div className={styles.timeSelect} ref={ref}>
      <button type="button" className={styles.timeBtn} onClick={() => setOpen(v => !v)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        {value}
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={`${styles.timeCaret} ${open ? styles.timeCaretOpen : ''}`}>
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className={styles.timeDropdown} ref={listRef}>
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              className={`${styles.timeOption} ${opt === value ? styles.timeOptionActive : ''}`}
              onClick={() => { onChange(opt); setOpen(false) }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CreateServiceModal({ open, onClose, teacherId, onCreated }: Props) {
  const locale = useLocale()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [duration, setDuration] = useState(60)
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('21:00')
  const [isGroup, setIsGroup] = useState(false)
  const [price, setPrice] = useState('')
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState('')
  const [promoLimit, setPromoLimit] = useState('')
  const [promoConditions, setPromoConditions] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isPersonal, setIsPersonal] = useState(false)
  const [personalStudentId, setPersonalStudentId] = useState('')
  const [students, setStudents] = useState<{ id: string; name: string; avatarUrl: string | null }[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  // Fetch categories for the preview card (slug/translations shape)
  useEffect(() => {
    if (!open) return
    fetch('/api/categories')
      .then(r => r.json())
      .then((data: { id: string; slug: string; name: string; levelNumber: number }[]) => {
        const opts: CategoryOption[] = data
          .filter(c => c.levelNumber === 1)
          .map(c => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            translations: [{ langCode: 'ru', name: c.name }],
          }))
        setCategories(opts)
      })
      .catch(() => {})
  }, [open])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTitle(''); setDescription(''); setPhotoUrl(null)
      setCategoryIds([]); setDuration(60)
      setTimeFrom('09:00'); setTimeTo('21:00')
      setIsGroup(false); setPrice('')
      setPromoOpen(false); setPromoCode(''); setPromoDiscount(''); setPromoLimit(''); setPromoConditions('')
      setError('')
      setIsPersonal(false); setPersonalStudentId(''); setStudents([])
    }
  }, [open])

  if (!open) return null

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoUrl(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Введите название'); return }
    if (!price || Number(price) <= 0) { setError('Введите цену'); return }

    setSubmitting(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        photoUrl: photoUrl ?? undefined,
        categoryId: categoryIds[0] || undefined,
        duration,
        timeFrom,
        timeTo,
        isGroup,
        price: Number(price),
      }
      if (promoOpen && promoCode.trim() && promoDiscount) {
        body.promoCode = {
          code: promoCode.trim().toUpperCase(),
          discount: Number(promoDiscount),
          usageLimit: promoLimit ? Number(promoLimit) : undefined,
          conditions: promoConditions.trim() || undefined,
        }
      }
      if (isPersonal && personalStudentId) {
        body.isPersonal = true
        body.targetStudentId = personalStudentId
      }
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ошибка при создании'); return }
      onCreated(data.service)
      onClose()
    } catch {
      setError('Ошибка сети')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCategory = categories.find(c => c.id === categoryIds[0]) ?? null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.heading}>Новая услуга</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {/* ── LEFT: Form ── */}
          <form className={styles.form} onSubmit={handleSubmit} id="service-form">

            {/* Photo */}
            <div className={styles.field}>
              <label className={styles.label}>Фото</label>
              <div
                className={styles.photoArea}
                style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : {}}
                onClick={() => fileRef.current?.click()}
              >
                {!photoUrl && (
                  <span className={styles.photoPlaceholder}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Добавить фото</span>
                  </span>
                )}
                {photoUrl && (
                  <button type="button" className={styles.photoRemove} onClick={e => { e.stopPropagation(); setPhotoUrl(null) }}>
                    ✕
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </div>

            {/* Title */}
            <div className={styles.field}>
              <label className={styles.label}>Название *</label>
              <input
                className={styles.input}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Например: Индивидуальный урок английского"
                maxLength={120}
              />
            </div>

            {/* Description */}
            <div className={styles.field}>
              <label className={styles.label}>Описание</label>
              <textarea
                className={styles.textarea}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Расскажите о содержании занятия..."
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Category — reuse existing CategorySelect */}
            <div className={styles.field}>
              <label className={styles.label}>Категория</label>
              <CategorySelect
                canSelectMany={false}
                maxLevel={1}
                value={categoryIds}
                onChange={setCategoryIds}
                placeholder="— Выберите категорию —"
              />
            </div>

            {/* Duration */}
            <div className={styles.field}>
              <label className={styles.label}>Продолжительность</label>
              <div className={styles.durationGroup}>
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    className={`${styles.durationBtn} ${duration === d.value ? styles.durationBtnActive : ''}`}
                    onClick={() => setDuration(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time range */}
            <div className={styles.field}>
              <label className={styles.label}>Время приёма</label>
              <div className={styles.timeRow}>
                <span className={styles.timeRowLabel}>с</span>
                <TimeSelect value={timeFrom} onChange={setTimeFrom} />
                <span className={styles.timeRowLabel}>по</span>
                <TimeSelect value={timeTo} onChange={setTimeTo} />
              </div>
            </div>

            {/* Type toggle */}
            <div className={styles.field}>
              <label className={styles.label}>Формат</label>
              <div className={styles.toggle}>
                <button type="button" className={`${styles.toggleBtn} ${!isGroup ? styles.toggleActive : ''}`} onClick={() => setIsGroup(false)}>
                  Личная
                </button>
                <button type="button" className={`${styles.toggleBtn} ${isGroup ? styles.toggleActive : ''}`} onClick={() => setIsGroup(true)}>
                  Групповая
                </button>
              </div>
            </div>

            {/* Price */}
            <div className={styles.field}>
              <label className={styles.label}>Цена *</label>
              <div className={styles.priceWrap}>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={1}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0"
                />
                <span className={styles.priceSuffix}>₽</span>
              </div>
            </div>

            {/* Personal service */}
            <div className={styles.personalSection}>
              <label className={styles.personalToggle}>
                <input
                  type="checkbox"
                  checked={isPersonal}
                  onChange={e => {
                    setIsPersonal(e.target.checked)
                    if (e.target.checked && students.length === 0) {
                      setStudentsLoading(true)
                      fetch('/api/call/my-students')
                        .then(r => r.json())
                        .then(d => setStudents(d.students ?? []))
                        .finally(() => setStudentsLoading(false))
                    }
                  }}
                />
                Личная услуга для конкретного ученика
              </label>
              {isPersonal && (
                <div className={styles.studentPicker}>
                  {studentsLoading ? (
                    <span>Загрузка учеников…</span>
                  ) : students.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#bbb' }}>Нет связанных учеников</span>
                  ) : (
                    <select
                      className={styles.input}
                      value={personalStudentId}
                      onChange={e => setPersonalStudentId(e.target.value)}
                    >
                      <option value="">— Выберите ученика —</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Promo code */}
            <div className={styles.promoSection}>
              <button type="button" className={styles.promoToggle} onClick={() => setPromoOpen(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {promoOpen ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                </svg>
                {promoOpen ? 'Скрыть промокод' : 'Добавить промокод'}
              </button>
              {promoOpen && (
                <div className={styles.promoFields}>
                  <div className={styles.row}>
                    <div className={styles.field} style={{ flex: 2 }}>
                      <label className={styles.label}>Код</label>
                      <div className={styles.promoCodeRow}>
                        <input
                          className={styles.input}
                          type="text"
                          value={promoCode}
                          onChange={e => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="SUMMER20"
                          maxLength={20}
                        />
                        <button type="button" className={styles.genBtn} onClick={() => setPromoCode(randomCode())} title="Сгенерировать">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Скидка %</label>
                      <input className={styles.input} type="number" min={1} max={100} value={promoDiscount} onChange={e => setPromoDiscount(e.target.value)} placeholder="10" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Лимит</label>
                      <input className={styles.input} type="number" min={1} value={promoLimit} onChange={e => setPromoLimit(e.target.value)} placeholder="∞" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Условие выдачи <span style={{ fontWeight: 400, color: '#bbb' }}>(необязательно)</span></label>
                    <input
                      className={styles.input}
                      type="text"
                      value={promoConditions}
                      onChange={e => setPromoConditions(e.target.value)}
                      placeholder="Например: после 5 видеоуроков, за прохождение роадмапа..."
                      maxLength={200}
                    />
                  </div>
                </div>
              )}
            </div>

            {error && <div className={styles.error}>{error}</div>}
          </form>

          {/* ── RIGHT: Live preview ── */}
          <div className={styles.preview}>
            <div className={styles.previewLabel}>Предпросмотр</div>
            <div className={styles.previewCard}>
              <ServiceCard
                id="preview"
                title={title || 'Название услуги'}
                photoUrl={photoUrl}
                duration={duration}
                timeFrom={timeFrom}
                timeTo={timeTo}
                isGroup={isGroup}
                price={Number(price) || 0}
                category={selectedCategory ?? null}
                locale={locale}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>Отмена</button>
          <button type="submit" form="service-form" className={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Сохранение...' : 'Создать услугу'}
          </button>
        </div>
      </div>
    </div>
  )
}
