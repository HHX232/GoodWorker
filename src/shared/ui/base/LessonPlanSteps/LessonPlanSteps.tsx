'use client'

import {LessonPlanStep} from '@/shared/types/Calendar/calendar.types'
import {AlertTriangle, Check, ChevronDown, ChevronRight, Circle, PlayCircle} from 'lucide-react'
import {useState} from 'react'
import styles from './LessonPlanSteps.module.scss'

interface LessonPlanSection {
  label: string
  steps: LessonPlanStep[]
}

interface LessonPlanStepsProps {
  sections: LessonPlanSection[]
}

function StatusIcon({status}: {status?: LessonPlanStep['status']}) {
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

export function LessonPlanSteps({sections}: LessonPlanStepsProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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
