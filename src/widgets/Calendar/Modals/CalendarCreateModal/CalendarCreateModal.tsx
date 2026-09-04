'use client'

import {useState, useEffect} from 'react'
import {useRouter} from 'next/navigation'
import {CalendarEvent, CalendarEventColor, LessonPlan} from '@/shared/types/Calendar/calendar.types'
import {EVENT_COLORS, formatDateKey} from '@/shared/helpers/calendar/calendar.helpers'
import {useLocale, useTranslations} from 'next-intl'
import {toast} from 'sonner'
import styles from './CalendarCreateModal.module.scss'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {LessonPlanModal} from '@/widgets/Calendar/Modals/LessonPlanModal/LessonPlanModal'
import {CategorySelect, getCategoryPath, useCategories} from '@/shared/ui/inputs/CategorySelect/CategorySelect'

type Tab = 'event' | 'note' | 'homework'

interface ServiceOption {
  id: string
  title: string
  price: number
  duration: number
}

interface StudentOption {
  id: string
  name: string
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
  teacherStudents?: StudentOption[]
  isVip?: boolean
}

const COLOR_OPTIONS = Object.keys(EVENT_COLORS) as CalendarEventColor[]

const EMPTY_FORM = {
  title: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  studentId: '',
  studentName: '',
  subject: '',
  categoryId: '',
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
  teacherStudents = [],
  isVip = false,
}: CalendarCreateModalProps) {
  const t = useTranslations('calendar.createModal')
  const tPlan = useTranslations('calendar.lessonPlan')
  const router = useRouter()
  const locale = useLocale()
  const {data: categories = []} = useCategories(locale)
  const [tab, setTab] = useState<Tab>('event')
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [studentFieldError, setStudentFieldError] = useState(false)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [autoSummary, setAutoSummary] = useState('')

  useEffect(() => {
    if (!isOpen) { setTab('event'); return }
    setStudentFieldError(false)
    setPlanModalOpen(false)
    setGeneratingPlan(false)
    if (editingEvent) {
      setForm({
        title: editingEvent.title,
        date: editingEvent.date,
        startTime: editingEvent.startTime,
        endTime: editingEvent.endTime,
        studentId: editingEvent.studentId ?? '',
        studentName: editingEvent.studentName ?? '',
        subject: editingEvent.subject ?? '',
        categoryId: editingEvent.categoryId ?? '',
        description: editingEvent.description ?? '',
        status: editingEvent.status ?? 'scheduled',
        color: editingEvent.color
      })
      setSelectedServiceId(editingEvent.serviceId ?? '')
      setLessonPlan(editingEvent.lessonPlan ?? null)
      setAutoSummary(editingEvent.lessonPlan?.summary ?? '')
    } else {
      setForm({
        ...EMPTY_FORM,
        date: initialDate ?? formatDateKey(new Date()),
        startTime: initialStartTime ?? '09:00',
        endTime: initialEndTime ?? '10:00'
      })
      setSelectedServiceId('')
      setLessonPlan(null)
      setAutoSummary('')
    }
  }, [isOpen, editingEvent, initialDate, initialStartTime, initialEndTime])

  const set =
    (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({...prev, [key]: e.target.value}))

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    const student = teacherStudents.find(s => s.id === id)
    setStudentFieldError(false)
    setForm((prev) => ({...prev, studentId: id, studentName: student?.name ?? ''}))
  }

  const handleGeneratePlan = async () => {
    if (!isVip) {
      toast.error(tPlan('vipToast'))
      return
    }
    if (!form.studentId) {
      setStudentFieldError(true)
      toast.error(tPlan('studentRequired'))
      return
    }
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/teacher/lesson-plan', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({studentId: form.studentId, categoryId: form.categoryId || undefined}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate plan')
      const plan: LessonPlan = data
      setLessonPlan(plan)
      setForm((prev) => ({
        ...prev,
        description: !prev.description.trim() || prev.description === autoSummary ? plan.summary : prev.description,
      }))
      setAutoSummary(plan.summary)
    } catch {
      toast.error(tPlan('generateError'))
    } finally {
      setGeneratingPlan(false)
    }
  }

  const handleSave = () => {
    if (!form.title.trim()) {
      document.getElementById('ce-title')?.focus()
      return
    }
    const svc = teacherServices?.find(s => s.id === selectedServiceId)
    const subjectPath = form.categoryId ? getCategoryPath(form.categoryId, categories) : ''
    onSave({
      ...(editingEvent ? {id: editingEvent.id} : {}),
      title: form.title.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      color: form.color,
      status: form.status,
      studentId: form.studentId || undefined,
      studentName: form.studentName.trim() || undefined,
      subject: subjectPath || undefined,
      categoryId: form.categoryId || undefined,
      description: form.description.trim() || undefined,
      noteType: tab === 'note' ? 'note' : undefined,
      lessonPlan: lessonPlan ?? undefined,
      ...(svc ? {
        serviceId: svc.id,
        serviceTitle: svc.title,
        servicePrice: svc.price,
        serviceDurationMinutes: svc.duration,
      } : {}),
    })
  }

  const isEditing = !!editingEvent

  const modalTitle = (
    <div className={styles.modalTitle}>
      <span className={styles.eyebrow}>{isEditing ? t('editEvent') : t('newEvent')}</span>
      <span className={styles.title}>{isEditing ? t('editTitle') : t('createTitle')}</span>
    </div>
  )

  return (
    <>
    <ModalWindowDefault isOpen={isOpen} onClose={onClose} additionalTitle={modalTitle}>

      {/* Tab switcher */}
      <div className={styles.tabRow}>
        <button
          type='button'
          className={`${styles.tabBtn} ${tab === 'event' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('event')}
        >
          Событие
        </button>
        <button type='button' className={`${styles.tabBtn} ${tab === 'note' ? styles.tabBtnActive : ''}`} onClick={() => setTab('note')}>
          Заметка
        </button>
        <button
          type='button'
          className={`${styles.tabBtn} ${tab === 'homework' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('homework')}
        >
          Д/З
        </button>
      </div>

      {tab === 'homework' ? (
        <div className={styles.hwPanel}>
          <p className={styles.hwPanelTitle}>Создать домашнее задание</p>
          <p className={styles.hwPanelSub}>Перейдите в конструктор, чтобы добавить блоки и назначить студентам.</p>
          <button
            type='button'
            className={styles.hwPanelBtn}
            onClick={() => {
              router.push(`/homework/create${form.date ? `?sendAt=${form.date}&dueAt=${form.date}T23:59` : ''}`)
              onClose()
            }}
          >
            Перейти в конструктор →
          </button>
        </div>
      ) : tab === 'note' ? (
        <>
          <div className={styles.body}>
            <div className={styles.field}>
              <label className={styles.label}>Заголовок</label>
              <input id='ce-title' className={styles.input} type='text' placeholder='Название заметки...' value={form.title} onChange={set('title')} autoFocus />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Дата</label>
              <input className={styles.input} type='date' value={form.date} onChange={set('date')} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Текст заметки</label>
              <textarea className={styles.textarea} placeholder='Напишите заметку...' value={form.description} onChange={set('description')} rows={5} />
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
        </>
      ) : (<>
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
            {teacherStudents.length > 0 ? (
              <select
                className={`${styles.input} ${studentFieldError ? styles.inputError : ''}`}
                value={form.studentId}
                onChange={handleStudentChange}
              >
                <option value=''>{t('studentPlaceholder')}</option>
                {teacherStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <input
                className={styles.input}
                type='text'
                placeholder={t('studentPlaceholder')}
                value={form.studentName}
                onChange={set('studentName')}
              />
            )}
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
            <CategorySelect
              langCode={locale}
              canSelectMany={false}
              maxLevel={3}
              value={form.categoryId ? [form.categoryId] : []}
              onChange={(ids) => setForm((prev) => ({...prev, categoryId: ids[0] ?? ''}))}
              placeholder={t('subjectPlaceholder')}
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
          <button
            type='button'
            className={`${styles.planBtn} ${!isVip ? styles.planBtnLocked : ''}`}
            onClick={handleGeneratePlan}
            disabled={generatingPlan}
          >
            {generatingPlan ? (
              tPlan('generating')
            ) : (
              <>
                {lessonPlan ? tPlan('regenerateButton') : tPlan('button')}
                {!isVip && (
                  <span className={styles.vipBadge}>{tPlan('vipBadge')}</span>
                )}
              </>
            )}
          </button>
          {lessonPlan && (
            <button
              type='button'
              className={styles.viewPlanBtn}
              onClick={() => setPlanModalOpen(true)}
            >
              {tPlan('viewFullPlan')}
            </button>
          )}
        </div>

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
      </>)}
    </ModalWindowDefault>
    <LessonPlanModal
      isOpen={planModalOpen}
      onClose={() => setPlanModalOpen(false)}
      plan={lessonPlan}
    />
    </>
  )
}
