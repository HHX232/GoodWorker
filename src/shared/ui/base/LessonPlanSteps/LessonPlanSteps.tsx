'use client'

import {AlertTriangle, Check, ChevronDown, ChevronRight, Circle, GripVertical, PlayCircle, Plus, X} from 'lucide-react'
import {useRef, useState} from 'react'
import styles from './LessonPlanSteps.module.scss'

export type StepStatus = 'success' | 'error' | 'active' | 'upcoming'

export interface EditableStep {
  id: string
  title: string
  description: string
  recommendation?: string
  status: StepStatus
}

interface LessonPlanSection {
  label: string
  steps: import('@/shared/types/Calendar/calendar.types').LessonPlanStep[]
}

interface ReadOnlyProps {
  editable?: false
  sections: LessonPlanSection[]
}

interface EditableProps {
  editable: true
  steps: EditableStep[]
  onChange: (steps: EditableStep[]) => void
  bucketLabels: Record<'review' | 'active' | 'upcoming', string>
  addLabel: string
}

type LessonPlanStepsProps = ReadOnlyProps | EditableProps

function StatusIcon({status}: {status?: StepStatus}) {
  switch (status) {
    case 'success':
      return <Check size={14} />
    case 'error':
      return <AlertTriangle size={14} />
    case 'active':
      return <PlayCircle size={14} />
    default:
      return <Circle size={8} fill='currentColor' />
  }
}

const BUCKET_OF: Record<StepStatus, 'review' | 'active' | 'upcoming'> = {
  success: 'review', error: 'review', active: 'active', upcoming: 'upcoming',
}
const DEFAULT_STATUS_OF_BUCKET: Record<'review' | 'active' | 'upcoming', StepStatus> = {
  review: 'success', active: 'active', upcoming: 'upcoming',
}
const BUCKET_ORDER = ['review', 'active', 'upcoming'] as const
const STATUS_CYCLE_BY_BUCKET: Record<'review' | 'active' | 'upcoming', StepStatus[]> = {
  review: ['success', 'error'], active: ['active'], upcoming: ['upcoming'],
}

/** Auto-growing borderless-until-focused textarea — the "invisible input" look. */
function InlineField({value, onChange, placeholder, multiline, className}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const grow = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  if (!multiline) {
    return (
      <input
        className={`${styles.inlineField} ${className ?? ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  return (
    <textarea
      ref={ref}
      className={`${styles.inlineField} ${styles.inlineFieldArea} ${className ?? ''}`}
      value={value}
      placeholder={placeholder}
      rows={1}
      onFocus={grow}
      onChange={(e) => { onChange(e.target.value); grow() }}
    />
  )
}

export function LessonPlanSteps(props: LessonPlanStepsProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const dragIdRef = useRef<string | null>(null)
  const newStepCounterRef = useRef(0)

  if (!props.editable) {
    const {sections} = props
    const flatSteps = sections.flatMap((section, sIdx) =>
      section.steps.map((step, stepIdx) => ({
        key: `${sIdx}-${stepIdx}`,
        sectionLabel: stepIdx === 0 ? section.label : null,
        isLast: sIdx === sections.length - 1 && stepIdx === section.steps.length - 1,
        step,
      }))
    )
    const toggle = (key: string) => setExpanded((prev) => ({...prev, [key]: !prev[key]}))

    if (flatSteps.length === 0) {
      return <p className={styles.empty}>Нет данных для плана</p>
    }

    return (
      <div className={styles.timeline}>
        {flatSteps.map(({key, sectionLabel, isLast, step}) => {
          const isOpen = !!expanded[key]
          const hasContent = !!(step.description || step.recommendation)
          return (
            <div key={key} className={styles.stepGroup}>
              {sectionLabel && <div className={styles.sectionLabel}>{sectionLabel}</div>}
              <div className={`${styles.step} ${isLast ? styles.stepLast : ''}`}>
                <div className={styles.iconCol}>
                  <div className={`${styles.iconCircle} ${styles[`status_${step.status ?? 'upcoming'}`]}`}>
                    <StatusIcon status={step.status} />
                  </div>
                  {!isLast && <div className={styles.connector} />}
                </div>
                <div className={styles.content}>
                  <div
                    className={`${styles.stepHeader} ${hasContent ? styles.stepHeaderClickable : ''}`}
                    onClick={() => hasContent && toggle(key)}
                  >
                    <span className={styles.stepTitle}>{step.title}</span>
                    {hasContent && (
                      <span className={styles.chevron}>
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                    )}
                  </div>
                  {hasContent && (
                    <div className={`${styles.stepBody} ${isOpen ? styles.stepBodyOpen : ''}`}>
                      <div className={styles.stepBodyInner}>
                        {step.description && <p className={styles.stepDescription}>{step.description}</p>}
                        {step.recommendation && (
                          <p className={styles.stepRecommendation}>{step.recommendation}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Editable mode ──────────────────────────────────────────────────────
  const {steps, onChange, bucketLabels, addLabel} = props

  const updateStep = (id: string, patch: Partial<EditableStep>) => {
    onChange(steps.map((s) => (s.id === id ? {...s, ...patch} : s)))
  }
  const deleteStep = (id: string) => onChange(steps.filter((s) => s.id !== id))
  const addStep = (bucket: 'review' | 'active' | 'upcoming') => {
    const id = `new-step-${newStepCounterRef.current++}`
    onChange([...steps, {id, title: '', description: '', recommendation: '', status: DEFAULT_STATUS_OF_BUCKET[bucket]}])
  }
  const cycleStatus = (step: EditableStep) => {
    const bucket = BUCKET_OF[step.status]
    const cycle = STATUS_CYCLE_BY_BUCKET[bucket]
    const next = cycle[(cycle.indexOf(step.status) + 1) % cycle.length]
    updateStep(step.id, {status: next})
  }

  const dropOnRow = (targetId: string, targetBucket: 'review' | 'active' | 'upcoming') => {
    const draggedId = dragIdRef.current
    dragIdRef.current = null
    if (!draggedId || draggedId === targetId) return
    const dragged = steps.find((s) => s.id === draggedId)
    if (!dragged) return
    const withoutDragged = steps.filter((s) => s.id !== draggedId)
    const targetIdx = withoutDragged.findIndex((s) => s.id === targetId)
    const movedStatus = BUCKET_OF[dragged.status] === targetBucket ? dragged.status : DEFAULT_STATUS_OF_BUCKET[targetBucket]
    const moved = {...dragged, status: movedStatus}
    const next = [...withoutDragged]
    next.splice(targetIdx, 0, moved)
    onChange(next)
  }

  const dropOnBucketEnd = (bucket: 'review' | 'active' | 'upcoming') => {
    const draggedId = dragIdRef.current
    dragIdRef.current = null
    if (!draggedId) return
    const dragged = steps.find((s) => s.id === draggedId)
    if (!dragged) return
    const movedStatus = BUCKET_OF[dragged.status] === bucket ? dragged.status : DEFAULT_STATUS_OF_BUCKET[bucket]
    onChange([...steps.filter((s) => s.id !== draggedId), {...dragged, status: movedStatus}])
  }

  return (
    <div className={styles.timeline}>
      {BUCKET_ORDER.map((bucket) => {
        const bucketSteps = steps.filter((s) => BUCKET_OF[s.status] === bucket)
        return (
          <div
            key={bucket}
            className={styles.editBucket}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOnBucketEnd(bucket)}
          >
            <div className={styles.sectionLabel}>{bucketLabels[bucket]}</div>
            {bucketSteps.map((step) => (
              <div
                key={step.id}
                className={styles.editStep}
                draggable
                onDragStart={() => { dragIdRef.current = step.id }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.stopPropagation(); dropOnRow(step.id, bucket) }}
              >
                <span className={styles.dragHandle}><GripVertical size={14} /></span>
                <button
                  type='button'
                  className={`${styles.iconCircle} ${styles.iconCircleBtn} ${styles[`status_${step.status}`]}`}
                  onClick={() => cycleStatus(step)}
                  title='Изменить статус'
                >
                  <StatusIcon status={step.status} />
                </button>
                <div className={styles.editContent}>
                  <InlineField
                    value={step.title}
                    onChange={(v) => updateStep(step.id, {title: v})}
                    placeholder='Название темы'
                    className={styles.inlineFieldTitle}
                  />
                  <InlineField
                    value={step.description}
                    onChange={(v) => updateStep(step.id, {description: v})}
                    placeholder='Описание'
                    multiline
                  />
                  {(step.recommendation || bucket === 'review') && (
                    <InlineField
                      value={step.recommendation ?? ''}
                      onChange={(v) => updateStep(step.id, {recommendation: v})}
                      placeholder='Рекомендация'
                      multiline
                      className={styles.inlineFieldRecommendation}
                    />
                  )}
                </div>
                <button type='button' className={styles.deleteBtn} onClick={() => deleteStep(step.id)} title='Удалить'>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type='button' className={styles.addStepBtn} onClick={() => addStep(bucket)}>
              <Plus size={13} /> {addLabel}
            </button>
          </div>
        )
      })}
    </div>
  )
}
