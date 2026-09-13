'use client'

import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {EditableStep, LessonPlanSteps, StepStatus} from '@/shared/ui/base/LessonPlanSteps/LessonPlanSteps'
import {LessonPlan, LessonPlanStep} from '@/shared/types/Calendar/calendar.types'
import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'
import styles from './LessonPlanModal.module.scss'

interface LessonPlanModalProps {
  isOpen: boolean
  onClose: () => void
  plan: LessonPlan | null
  onSave?: (plan: LessonPlan) => void
}

function planToSteps(plan: LessonPlan): EditableStep[] {
  let n = 0
  const id = () => `step-${n++}`
  return [
    ...plan.reviewSteps.map((s) => ({id: id(), title: s.title, description: s.description, recommendation: s.recommendation ?? '', status: (s.status ?? 'success') as StepStatus})),
    ...plan.activeSteps.map((s) => ({id: id(), title: s.title, description: s.description, recommendation: '', status: 'active' as StepStatus})),
    ...plan.upcomingSteps.map((s) => ({id: id(), title: s.title, description: s.description, recommendation: '', status: 'upcoming' as StepStatus})),
  ]
}

function stepsToPlan(steps: EditableStep[], base: LessonPlan): LessonPlan {
  const strip = (s: EditableStep): LessonPlanStep => ({title: s.title, description: s.description})
  return {
    ...base,
    reviewSteps: steps.filter((s) => s.status === 'success' || s.status === 'error')
      .map((s) => ({...strip(s), status: s.status, recommendation: s.recommendation || undefined})),
    activeSteps: steps.filter((s) => s.status === 'active').map(strip),
    upcomingSteps: steps.filter((s) => s.status === 'upcoming').map(strip),
  }
}

export function LessonPlanModal({isOpen, onClose, plan, onSave}: LessonPlanModalProps) {
  const t = useTranslations('calendar.lessonPlan')
  const [steps, setSteps] = useState<EditableStep[]>([])
  const [dirty, setDirty] = useState(false)
  const [aiEditOpen, setAiEditOpen] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (plan) {
      setSteps(planToSteps(plan))
      setDirty(false)
      setAiEditOpen(false)
      setAiInstructions('')
    }
  }, [plan])

  if (!plan) return null

  const handleChangeSteps = (next: EditableStep[]) => {
    setSteps(next)
    setDirty(true)
  }

  const handleSave = () => {
    onSave?.(stepsToPlan(steps, plan))
    setDirty(false)
  }

  const handleAiEdit = async () => {
    if (!aiInstructions.trim()) return
    setAiLoading(true)
    try {
      const currentPlan = stepsToPlan(steps, plan)
      const res = await fetch('/api/teacher/lesson-plan/revise', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({plan: currentPlan, instructions: aiInstructions.trim()}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'failed')
      setSteps(planToSteps(data as LessonPlan))
      setDirty(true)
      setAiEditOpen(false)
      setAiInstructions('')
    } catch {
      toast.error(t('aiEditError'))
    } finally {
      setAiLoading(false)
    }
  }

  const header = (
    <div className={styles.headerLeft}>
      <div className={styles.eyebrow}>{plan.subject}</div>
      <div className={styles.title}>{t('modalTitle')}</div>
    </div>
  )

  return (
    <ModalWindowDefault isOpen={isOpen} onClose={onClose} additionalTitle={header}>
      <div className={styles.body}>
        <LessonPlanSteps
          editable
          steps={steps}
          onChange={handleChangeSteps}
          bucketLabels={{review: t('sectionReview'), active: t('sectionActive'), upcoming: t('sectionUpcoming')}}
          addLabel={t('addStep')}
        />
      </div>

      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <button type='button' className={styles.btnSecondary} onClick={() => setAiEditOpen((v) => !v)}>
            {t('aiEditButton')}
          </button>
          {dirty && (
            <button className={styles.btnPrimary} onClick={handleSave}>
              {t('saveChanges')}
            </button>
          )}
        </div>
        {aiEditOpen && (
          <div className={styles.aiEditRow}>
            <input
              className={styles.aiEditInput}
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              placeholder={t('aiEditPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleAiEdit()}
              autoFocus
            />
            <button
              type='button'
              className={styles.btnPrimary}
              onClick={handleAiEdit}
              disabled={aiLoading || !aiInstructions.trim()}
            >
              {aiLoading ? t('aiEditLoading') : t('aiEditSubmit')}
            </button>
          </div>
        )}
      </div>
    </ModalWindowDefault>
  )
}
