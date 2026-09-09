'use client'

import {useState, useEffect} from 'react'
import {useRouter} from 'next/navigation'
import {CalendarEvent, CalendarEventColor, LessonPlan} from '@/shared/types/Calendar/calendar.types'
import {EVENT_COLORS, formatDateKey} from '@/shared/helpers/calendar/calendar.helpers'
import {MAX_RECURRENCE_OCCURRENCES, generateRecurrenceDates, pluralize} from '@/shared/helpers/calendar/recurrence.helpers'
import {formatGradeLabel} from '@/shared/lib/formatGrade'
import {useLocale, useTranslations} from 'next-intl'
import {toast} from 'sonner'
import styles from './CalendarCreateModal.module.scss'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {LessonPlanModal} from '@/widgets/Calendar/Modals/LessonPlanModal/LessonPlanModal'
import {CategorySelect, getCategoryPath, useCategories} from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import {SelectUI} from '@/shared/ui/inputs/SelectUI/SelectUI'

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
  schoolGrade?: number | null
  courseNumber?: number | null
}

interface CalendarCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: Omit<CalendarEvent, 'id'> & {id?: string}) => void
  onSaveMany?: (events: Omit<CalendarEvent, 'id'>[]) => void
  initialDate?: string | null
  initialStartTime?: string | null
  initialEndTime?: string | null
  editingEvent?: CalendarEvent | null
  teacherServices?: ServiceOption[]
  teacherStudents?: StudentOption[]
  teacherCategoryIds?: string[]
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
  onSaveMany,
  initialDate,
  initialStartTime,
  initialEndTime,
  editingEvent,
  teacherServices,
  teacherStudents = [],
  teacherCategoryIds,
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
  const [subjectFieldError, setSubjectFieldError] = useState(false)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [autoSummary, setAutoSummary] = useState('')
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatFreq, setRepeatFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([])
  const [repeatEndType, setRepeatEndType] = useState<'count' | 'until'>('count')
  const [repeatCount, setRepeatCount] = useState(8)
  const [repeatUntil, setRepeatUntil] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')

  useEffect(() => {
    if (!isOpen) { setTab('event'); return }
    setStudentFieldError(false)
    setSubjectFieldError(false)
    setPlanModalOpen(false)
    setGeneratingPlan(false)
    setRepeatEnabled(false)
    setRepeatFreq('weekly')
    setRepeatInterval(1)
    setRepeatWeekdays([])
    setRepeatEndType('count')
    setRepeatCount(8)
    setRepeatUntil('')
    setAdditionalNotes('')
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
    if (!form.categoryId) {
      setSubjectFieldError(true)
      toast.error(tPlan('subjectRequired'))
      return
    }
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/teacher/lesson-plan', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({studentId: form.studentId, categoryId: form.categoryId, additionalNotes: additionalNotes.trim() || undefined}),
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

    const baseEvent: Omit<CalendarEvent, 'id' | 'date'> = {
      title: form.title.trim(),
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
    }

    if (!isEditing && repeatEnabled && onSaveMany) {
      if (repeatFreq === 'weekly' && repeatWeekdays.length === 0) {
        toast.error(t('repeatWeekdaysRequired'))
        return
      }
      const dates = generateRecurrenceDates({
        freq: repeatFreq,
        interval: repeatInterval,
        byWeekday: repeatWeekdays,
        endType: repeatEndType,
        count: repeatCount,
        until: repeatUntil || undefined,
        startDate: form.date,
      })
      if (dates.length === 0) {
        toast.error(t('repeatGenerateError'))
        return
      }
      if (dates.length > MAX_RECURRENCE_OCCURRENCES) {
        toast.error(t('repeatTooMany'))
        return
      }
      const recurrenceRule = {
        freq: repeatFreq,
        interval: repeatInterval,
        byWeekday: repeatFreq === 'weekly' ? repeatWeekdays : undefined,
        count: repeatEndType === 'count' ? repeatCount : undefined,
        until: repeatEndType === 'until' ? repeatUntil : undefined,
      }
      onSaveMany(dates.map((date) => ({...baseEvent, date, recurrenceRule})))
      return
    }

    onSave({
      ...(editingEvent ? {id: editingEvent.id} : {}),
      ...baseEvent,
      date: form.date,
    })
  }

  const isEditing = !!editingEvent

  const toggleWeekday = (idx: number) => {
    setRepeatWeekdays((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort()))
  }

  const handleToggleRepeat = (checked: boolean) => {
    setRepeatEnabled(checked)
    if (checked && repeatWeekdays.length === 0 && form.date) {
      const [y, m, d] = form.date.split('-').map(Number)
      const jsDay = new Date(y, m - 1, d).getDay()
      setRepeatWeekdays([(jsDay + 6) % 7])
    }
  }

  const freqUnitForms: Record<'daily' | 'weekly' | 'monthly', [string, string, string]> = {
    daily: [t('repeatIntervalUnitDaily_one'), t('repeatIntervalUnitDaily_few'), t('repeatIntervalUnitDaily_many')],
    weekly: [t('repeatIntervalUnitWeekly_one'), t('repeatIntervalUnitWeekly_few'), t('repeatIntervalUnitWeekly_many')],
    monthly: [t('repeatIntervalUnitMonthly_one'), t('repeatIntervalUnitMonthly_few'), t('repeatIntervalUnitMonthly_many')],
  }

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
              <input className={styles.input} type='date' value={form.date} onChange={set('date')} onClick={(e) => e.currentTarget.showPicker?.()} />
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
            <input className={styles.input} type='date' value={form.date} onChange={set('date')} onClick={(e) => e.currentTarget.showPicker?.()} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('studentLabel')}</label>
            {teacherStudents.length > 0 ? (
              <SelectUI
                error={studentFieldError}
                value={form.studentId}
                onChange={(id) => {
                  const student = teacherStudents.find(s => s.id === id)
                  setStudentFieldError(false)
                  setForm((prev) => ({...prev, studentId: id, studentName: student?.name ?? ''}))
                }}
                options={[
                  {value: '', label: t('studentPlaceholder')},
                  ...teacherStudents.map(s => {
                    const gradeLabel = formatGradeLabel(s.schoolGrade, s.courseNumber)
                    return {value: s.id, label: gradeLabel ? `${s.name} (${gradeLabel})` : s.name}
                  }),
                ]}
              />
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

        {!isEditing && (
          <button
            type='button'
            className={`${styles.repeatToggle} ${repeatEnabled ? styles.repeatToggleActive : ''}`}
            onClick={() => handleToggleRepeat(!repeatEnabled)}
          >
            <span className={styles.repeatToggleDot} />
            {t('repeatLabel')}
          </button>
        )}

        {!isEditing && repeatEnabled && (
          <div className={styles.repeatPanel}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>{t('repeatFreqLabel')}</label>
                <SelectUI
                  value={repeatFreq}
                  onChange={(v) => setRepeatFreq(v as 'daily' | 'weekly' | 'monthly')}
                  options={[
                    {value: 'daily', label: t('repeatFreqDaily')},
                    {value: 'weekly', label: t('repeatFreqWeekly')},
                    {value: 'monthly', label: t('repeatFreqMonthly')},
                  ]}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('repeatIntervalLabel')}</label>
                <div className={styles.intervalRow}>
                  <input
                    className={styles.input}
                    type='number'
                    min={1}
                    max={30}
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Math.max(1, Number(e.target.value) || 1))}
                  />
                  <span className={styles.intervalUnit}>
                    {pluralize(locale, repeatInterval, freqUnitForms[repeatFreq])}
                  </span>
                </div>
              </div>
            </div>

            {repeatFreq === 'weekly' && (
              <div className={styles.field}>
                <label className={styles.label}>{t('repeatWeekdaysLabel')}</label>
                <div className={styles.weekdayPicker}>
                  {[t('weekdayMon'), t('weekdayTue'), t('weekdayWed'), t('weekdayThu'), t('weekdayFri'), t('weekdaySat'), t('weekdaySun')].map((label, i) => (
                    <button
                      key={i}
                      type='button'
                      className={`${styles.weekdayChip} ${repeatWeekdays.includes(i) ? styles.weekdayChipSelected : ''}`}
                      onClick={() => toggleWeekday(i)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>{t('repeatEndLabel')}</label>
              <div className={styles.repeatEndTabRow}>
                <button
                  type='button'
                  className={`${styles.tabBtn} ${repeatEndType === 'count' ? styles.tabBtnActive : ''}`}
                  onClick={() => setRepeatEndType('count')}
                >
                  {t('repeatEndByCount')}
                </button>
                <button
                  type='button'
                  className={`${styles.tabBtn} ${repeatEndType === 'until' ? styles.tabBtnActive : ''}`}
                  onClick={() => setRepeatEndType('until')}
                >
                  {t('repeatEndByDate')}
                </button>
              </div>
              {repeatEndType === 'count' ? (
                <input
                  className={styles.input}
                  type='number'
                  min={1}
                  max={MAX_RECURRENCE_OCCURRENCES}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Math.max(1, Number(e.target.value) || 1))}
                />
              ) : (
                <input
                  className={styles.input}
                  type='date'
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
              )}
            </div>
          </div>
        )}

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
              allowedRootIds={teacherCategoryIds}
              error={subjectFieldError}
              value={form.categoryId ? [form.categoryId] : []}
              onChange={(ids) => {
                setSubjectFieldError(false)
                setForm((prev) => ({...prev, categoryId: ids[0] ?? ''}))
              }}
              placeholder={t('subjectPlaceholder')}
              triggerClassName={styles.categorySelectTrigger}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('statusLabel')}</label>
            <SelectUI
              value={form.status ?? 'scheduled'}
              onChange={(v) => setForm((prev) => ({...prev, status: v as CalendarEvent['status']}))}
              options={[
                {value: 'scheduled', label: t('statusScheduled')},
                {value: 'completed', label: t('statusCompleted')},
                {value: 'cancelled', label: t('statusCancelled')},
              ]}
            />
          </div>
        </div>

        {teacherServices && teacherServices.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>{t('serviceLabel')}</label>
            <SelectUI
              value={selectedServiceId}
              onChange={setSelectedServiceId}
              options={[
                {value: '', label: t('noService')},
                ...teacherServices.map(s => ({
                  value: s.id,
                  label: `${s.title} — ${s.price.toLocaleString()} ₽ / ${s.duration} мин`,
                })),
              ]}
            />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>{tPlan('additionalNotesLabel')}</label>
          <textarea
            className={styles.textarea}
            placeholder={tPlan('additionalNotesPlaceholder')}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            rows={2}
          />
        </div>

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
