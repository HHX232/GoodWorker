'use client'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {useTranslations} from 'next-intl'
import styles from './RoadmapFeedbackDetailModal.module.scss'

type QuestionType = 'single' | 'multi' | 'free'

interface Option {
  id: string
  text: string
}

interface Question {
  id: string
  type: QuestionType
  text: string
  options: Option[]
}

interface FeedbackNode {
  nodeId: string
  questions: unknown[]
  submissionCount: number
  submissions: {answers: unknown}[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  feedback: FeedbackNode[]
}

function OptionStats({
  question,
  submissions,
  t,
}: {
  question: Question
  submissions: {answers: unknown}[]
  t: (k: string) => string
}) {
  const total = submissions.length
  if (total === 0) return <p className={styles.no_answers}>{t('feedbackNoAnswers')}</p>

  if (question.type === 'free') {
    const texts = submissions
      .map((s) => {
        const ans = (s.answers as Record<string, unknown>)?.[question.id]
        return typeof ans === 'string' ? ans.trim() : null
      })
      .filter(Boolean) as string[]

    return (
      <div className={styles.free_answers}>
        {texts.length === 0 ? (
          <p className={styles.no_answers}>{t('feedbackNoAnswers')}</p>
        ) : (
          texts.map((text, i) => (
            <div key={i} className={styles.free_answer_item}>
              {text}
            </div>
          ))
        )}
      </div>
    )
  }

  const countMap = new Map<string, number>()
  for (const s of submissions) {
    const raw = (s.answers as Record<string, unknown>)?.[question.id]
    const ids = Array.isArray(raw) ? raw : raw ? [raw] : []
    for (const id of ids) {
      countMap.set(String(id), (countMap.get(String(id)) ?? 0) + 1)
    }
  }

  const maxCount = Math.max(...Array.from(countMap.values()), 1)

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
      {question.options.map((opt) => {
        const count = countMap.get(opt.id) ?? 0
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div key={opt.id} className={styles.option_row}>
            <span className={styles.option_label}>{opt.text || '—'}</span>
            <div className={styles.option_bar_wrap}>
              <div className={styles.option_bar} style={{width: `${pct}%`}} />
            </div>
            <span className={styles.option_count}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function FeedbackNodeBlock({node, index, t}: {node: FeedbackNode; index: number; t: (k: string, v?: Record<string, unknown>) => string}) {
  const questions = node.questions as Question[]

  return (
    <div className={styles.node_block}>
      <div className={styles.node_title}>
        <span>{t('feedbackNodeTitle', {num: index + 1})}</span>
        <span className={styles.node_count}>{t('feedbackNodeAnswers', {count: node.submissionCount})}</span>
      </div>

      {questions.length === 0 ? (
        <p className={styles.no_answers}>{t('feedbackNoQuestions')}</p>
      ) : (
        questions.map((q, qi) => (
          <div key={q.id} className={styles.question_block}>
            <p className={styles.question_text}>
              {qi + 1}. {q.text || <em style={{opacity: 0.5}}>{t('fbEmptyQuestion')}</em>}
            </p>
            <OptionStats question={q} submissions={node.submissions} t={t} />
            {qi < questions.length - 1 && <hr className={styles.divider} />}
          </div>
        ))
      )}
    </div>
  )
}

export function RoadmapFeedbackDetailModal({isOpen, onClose, feedback}: Props) {
  const t = useTranslations('roadMap')

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={(e) => { onClose(); e.stopPropagation?.() }}
      additionalTitle={<span style={{fontWeight: 700, fontSize: 16}}>{t('feedbackModalTitle')}</span>}
    >
      <div className={styles.wrap}>
        {feedback.length === 0 ? (
          <p className={styles.empty}>{t('feedbackEmpty')}</p>
        ) : (
          feedback.map((node, i) => (
            <FeedbackNodeBlock key={node.nodeId} node={node} index={i} t={t as (k: string, v?: Record<string, unknown>) => string} />
          ))
        )}
      </div>
    </ModalWindowDefault>
  )
}
