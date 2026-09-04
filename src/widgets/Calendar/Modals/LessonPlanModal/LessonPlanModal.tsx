'use client'

import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {LessonPlanSteps} from '@/shared/ui/base/LessonPlanSteps/LessonPlanSteps'
import {LessonPlan} from '@/shared/types/Calendar/calendar.types'
import {useTranslations} from 'next-intl'
import styles from './LessonPlanModal.module.scss'

interface LessonPlanModalProps {
  isOpen: boolean
  onClose: () => void
  plan: LessonPlan | null
}

export function LessonPlanModal({isOpen, onClose, plan}: LessonPlanModalProps) {
  const t = useTranslations('calendar.lessonPlan')

  if (!plan) return null

  const sections = [
    {label: t('sectionReview'), steps: plan.reviewSteps},
    {label: t('sectionActive'), steps: plan.activeSteps.map((s) => ({...s, status: 'active' as const}))},
    {label: t('sectionUpcoming'), steps: plan.upcomingSteps.map((s) => ({...s, status: 'upcoming' as const}))},
  ].filter((section) => section.steps.length > 0)

  return (
    <ModalWindowDefault isOpen={isOpen} onClose={onClose}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.eyebrow}>{plan.subject}</div>
          <div className={styles.title}>{t('modalTitle')}</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='none'>
            <path d='M18 6L6 18M6 6l12 12' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <LessonPlanSteps sections={sections} />
      </div>

      <div className={styles.footer}>
        <button className={styles.btnPrimary} onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </ModalWindowDefault>
  )
}
