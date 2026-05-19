// ActiveCommentBlock.tsx
// Editor mode (isView=false): teacher creates questions stored in nodeData.activeComment
// View mode (onlyPass=true): student answers; 1 submission per student per node stored via API

import {getNodeHeaderIconColor} from '@/shared/helpers/Node/getNodeHeaderIconColor'
import {useRoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useReactFlow} from '@xyflow/react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Swiper, SwiperSlide} from 'swiper/react'
import type {Swiper as SwiperType} from 'swiper'
import 'swiper/css'
import s from './ActiveCommentBlock.module.scss'

// ─────────────────────────── Types ───────────────────────────

type QuestionType = 'single' | 'multi' | 'free'

interface Option {
  id: string
  text: string
  isCorrect: boolean
}

interface Question {
  id: string
  type: QuestionType
  text: string
  options: Option[]
}

interface ActiveCommentBlockProps {
  nodeId: string
  onlyPass?: boolean
  headerColor?: string
  t?: (key: string) => string
}

// ─────────────────────── CSS variable injection ───────────────────────

function buildCssVars(headerColor?: string): React.CSSProperties {
  const bg = headerColor || '#141416'
  const text = headerColor ? (getNodeHeaderIconColor(headerColor) ?? '#fff') : '#fff'
  return {
    '--accent-bg': bg,
    '--accent-text': text,
  } as React.CSSProperties
}

// ─────────────────────────── Helpers ───────────────────────────

const uid = () => Math.random().toString(36).slice(2, 8)

const defaultT = (key: string): string => {
  const map: Record<string, string> = {
    fbEditorLabel:          'Feedback editor',
    fbNoQuestions:          'No questions added yet',
    fbAddQuestion:          '+ Add question',
    fbAddNextQuestion:      '+ Question',
    fbSubmit:               'Submit answers',
    fbSubmitted:            'Submitted ✓',
    fbThankYou:             'Thank you for your feedback!',
    fbFreeAnswerPlaceholder:'Enter your answer...',
    fbSingle:               'Single choice',
    fbMulti:                'Multiple choice',
    fbFree:                 'Free answer',
    fbQuestionPlaceholder:  'Enter question text...',
    fbOptionPlaceholder:    'Answer option...',
    fbAddOption:            '+ Option',
    fbEmptyQuestion:        'Empty question',
    fbEmptyOption:          'Option',
    navPrev:                'Previous',
    navNext:                'Next',
  }
  return map[key] ?? key
}

// ─────────────────────────── Sub-components ───────────────────────────

function TypeToggle({
  value,
  onChange,
  t,
}: {
  value: QuestionType
  onChange: (v: QuestionType) => void
  t: (k: string) => string
}) {
  const types: QuestionType[] = ['single', 'multi', 'free']
  return (
    <div className={s.typeToggle}>
      {types.map((tp) => (
        <button
          key={tp}
          className={`${s.typePill} ${value === tp ? s.typePillActive : ''}`}
          onClick={() => onChange(tp)}
          type='button'
        >
          {t(`fb${tp.charAt(0).toUpperCase()}${tp.slice(1)}`)}
        </button>
      ))}
    </div>
  )
}

function EditorQuestion({
  question,
  index,
  onChange,
  onRemove,
  t,
}: {
  question: Question
  index: number
  onChange: (q: Question) => void
  onRemove: () => void
  t: (k: string) => string
}) {
  const updateText = (text: string) => onChange({...question, text})

  const updateType = (type: QuestionType) =>
    onChange({
      ...question,
      type,
      options:
        type === 'free'
          ? []
          : question.options.length
            ? question.options
            : [{id: uid(), text: '', isCorrect: false}],
    })

  const addOption = () =>
    onChange({...question, options: [...question.options, {id: uid(), text: '', isCorrect: false}]})

  const updateOption = (id: string, patch: Partial<Option>) =>
    onChange({...question, options: question.options.map((o) => (o.id === id ? {...o, ...patch} : o))})

  const removeOption = (id: string) =>
    onChange({...question, options: question.options.filter((o) => o.id !== id)})

  const toggleCorrect = (id: string) => {
    if (question.type === 'single') {
      onChange({...question, options: question.options.map((o) => ({...o, isCorrect: o.id === id}))})
    } else {
      updateOption(id, {isCorrect: !question.options.find((o) => o.id === id)?.isCorrect})
    }
  }

  return (
    <div className={s.questionCard}>
      <div className={s.questionHeader}>
        <span className={s.questionIndex}>#{index + 1}</span>
        <TypeToggle value={question.type} onChange={updateType} t={t} />
        <button className={s.removeBtn} onClick={onRemove} type='button'>✕</button>
      </div>

      <textarea
        className={s.questionTextarea}
        value={question.text}
        onChange={(e) => updateText(e.target.value)}
        placeholder={t('fbQuestionPlaceholder')}
        rows={2}
      />

      {question.type !== 'free' && (
        <div className={s.optionsList}>
          {question.options.map((opt, i) => (
            <div key={opt.id} className={s.optionRow}>
              <button
                type='button'
                className={`${s.correctToggle} ${opt.isCorrect ? s.correctToggleOn : ''}`}
                onClick={() => toggleCorrect(opt.id)}
              >
                {opt.isCorrect ? '✓' : '○'}
              </button>

              <input
                className={s.optionInput}
                value={opt.text}
                onChange={(e) => updateOption(opt.id, {text: e.target.value})}
                placeholder={`${t('fbOptionPlaceholder')} ${i + 1}`}
              />

              <button className={s.removeBtn} onClick={() => removeOption(opt.id)} type='button'>✕</button>
            </div>
          ))}

          <button className={s.addOptionBtn} onClick={addOption} type='button'>
            {t('fbAddOption')}
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────── View mode question ───────────────────────

function ViewQuestion({
  question,
  index,
  answer,
  onAnswer,
  t,
}: {
  question: Question
  index: number
  answer: string | string[]
  onAnswer: (val: string | string[]) => void
  t: (k: string) => string
}) {
  const toggleMulti = (id: string) => {
    const arr = Array.isArray(answer) ? answer : []
    onAnswer(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  return (
    <div className={s.viewQuestion}>
      <p className={s.viewQuestionText}>
        <span className={s.viewIndex}>{index + 1}.</span>{' '}
        {question.text || <em style={{opacity: 0.4}}>{t('fbEmptyQuestion')}</em>}
      </p>

      {question.type === 'free' && (
        <textarea
          className={s.freeTextarea}
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder={t('fbFreeAnswerPlaceholder')}
          rows={3}
        />
      )}

      {question.type === 'single' && (
        <div className={s.viewOptions}>
          {question.options.map((opt) => {
            const checked = answer === opt.id
            return (
              <label key={opt.id} className={`${s.viewOptionLabel} ${checked ? s.viewOptionChecked : ''}`}>
                <span className={`${s.radioCircle} ${checked ? s.radioCircleOn : ''}`} />
                {opt.text || <em style={{opacity: 0.4}}>{t('fbEmptyOption')}</em>}
                <input
                  type='radio'
                  name={question.id}
                  value={opt.id}
                  checked={checked}
                  onChange={() => onAnswer(opt.id)}
                  style={{display: 'none'}}
                />
              </label>
            )
          })}
        </div>
      )}

      {question.type === 'multi' && (
        <div className={s.viewOptions}>
          {question.options.map((opt) => {
            const checked = Array.isArray(answer) && answer.includes(opt.id)
            return (
              <label key={opt.id} className={`${s.viewOptionLabel} ${checked ? s.viewOptionChecked : ''}`}>
                <span className={`${s.checkBox} ${checked ? s.checkBoxOn : ''}`}>
                  {checked ? '✓' : ''}
                </span>
                {opt.text || <em style={{opacity: 0.4}}>{t('fbEmptyOption')}</em>}
                <input
                  type='checkbox'
                  checked={checked}
                  onChange={() => toggleMulti(opt.id)}
                  style={{display: 'none'}}
                />
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────── Swiper nav wrapper ───────────────────────

function QuestionSlider({
  questions,
  renderSlide,
  onAddQuestion,
  isEditor,
  t,
}: {
  questions: Question[]
  renderSlide: (q: Question, i: number) => React.ReactNode
  onAddQuestion?: () => void
  t: (k: string) => string
  isEditor: boolean
}) {
  const swiperRef = useRef<SwiperType | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const total = questions.length
  const isLast = activeIndex === total - 1

  const goNext = () => swiperRef.current?.slideNext()
  const goPrev = () => swiperRef.current?.slidePrev()

  return (
    <div className={s.swiperWrapper}>
      <Swiper
        onSwiper={(sw) => {swiperRef.current = sw}}
        onSlideChange={(sw) => setActiveIndex(sw.activeIndex)}
        slidesPerView={1}
        spaceBetween={12}
        allowTouchMove
      >
        {questions.map((q, i) => (
          <SwiperSlide key={q.id}>
            {renderSlide(q, i)}
          </SwiperSlide>
        ))}
      </Swiper>

      <div className={s.swiperNav}>
        <div className={s.swiperNavRow}>
          <button
            className={s.navBtn}
            onClick={goPrev}
            disabled={activeIndex === 0}
            type='button'
            aria-label={t('navPrev')}
          >
            ←
          </button>

          <span className={s.navCounter}>
            {total === 0 ? '—' : `${activeIndex + 1} / ${total}`}
          </span>

          <button
            className={s.navBtn}
            onClick={goNext}
            disabled={isLast}
            type='button'
            aria-label={t('navNext')}
          >
            →
          </button>
        </div>

        {isEditor && (
          <button
            className={s.addQuestionBtn}
            onClick={() => {
              onAddQuestion?.()
              setTimeout(() => swiperRef.current?.slideTo(total), 50)
            }}
            type='button'
          >
            {t('fbAddNextQuestion')}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────── Thank-you screen ───────────────────────

function ThankYouScreen({t}: {t: (k: string) => string}) {
  return (
    <div className={s.thankYouScreen}>
      <div className={s.thankYouIcon}>
        <svg width='32' height='32' viewBox='0 0 32 32' fill='none'>
          <circle cx='16' cy='16' r='15' stroke='#4caf7d' strokeWidth='2' />
          <path d='M9 16.5l5 5 9-9' stroke='#4caf7d' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </div>
      <p className={s.thankYouText}>{t('fbThankYou')}</p>
    </div>
  )
}

// ─────────────────────────── Main Component ───────────────────────────

export default function ActiveCommentBlock({
  nodeId,
  onlyPass = false,
  headerColor,
  t: tProp,
}: ActiveCommentBlockProps) {
  const t = tProp ?? defaultT
  const isView = onlyPass
  const cssVars = useMemo(() => buildCssVars(headerColor), [headerColor])
  const {roadmapId} = useRoadmapAccessContext()

  const {getNode, updateNodeData} = useReactFlow()

  // ── Read questions from nodeData.activeComment ──
  const nodeData = getNode(nodeId)?.data as (RoadNodeData & {activeComment?: Question[]}) | undefined
  const savedQuestions: Question[] = nodeData?.activeComment ?? []

  // Editor local state
  const [questions, setQuestions] = useState<Question[]>(
    savedQuestions.length > 0
      ? savedQuestions
      : [{id: uid(), type: 'single', text: '', options: [{id: uid(), text: '', isCorrect: false}]}]
  )

  // ── Persist to nodeData.activeComment on every change ──
  const persist = useCallback((next: Question[]) => {
    setQuestions(next)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateNodeData(nodeId, {activeComment: next} as any)
  }, [nodeId, updateNodeData])

  const addQuestion = useCallback(() => {
    persist([
      ...questions,
      {id: uid(), type: 'single', text: '', options: [{id: uid(), text: '', isCorrect: false}]},
    ])
  }, [questions, persist])

  const updateQuestion = useCallback((id: string, q: Question) => {
    persist(questions.map((x) => (x.id === id ? q : x)))
  }, [questions, persist])

  const removeQuestion = useCallback((id: string) => {
    persist(questions.filter((x) => x.id !== id))
  }, [questions, persist])

  // View state
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const setAnswer = (qId: string, val: string | string[]) =>
    setAnswers((prev) => ({...prev, [qId]: val}))

  // ── Check if already submitted on mount ──
  useEffect(() => {
    if (!isView || !roadmapId) return
    fetch(`/api/roadmap/${roadmapId}/feedback?nodeId=${nodeId}`)
      .then((r) => r.json())
      .then((data) => { if (data.submitted) setSubmitted(true) })
      .catch(() => {})
  }, [isView, roadmapId, nodeId])

  const handleSubmit = async () => {
    if (!roadmapId || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/roadmap/${roadmapId}/feedback`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({nodeId, answers}),
      })
      if (res.ok) setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  // ── EDITOR MODE ──
  if (!isView) {
    return (
      <div className={s.root} style={cssVars}>
        <div className={s.editorLabel}>
          <span>✏️</span> {t('fbEditorLabel')}
        </div>

        {questions.length === 0 ? (
          <>
            <p className={s.emptyHint}>{t('fbNoQuestions')}</p>
            <button className={s.addQuestionBtn} onClick={addQuestion} type='button'>
              {t('fbAddQuestion')}
            </button>
          </>
        ) : (
          <QuestionSlider
            questions={questions}
            isEditor
            t={t}
            onAddQuestion={addQuestion}
            renderSlide={(q, i) => (
              <EditorQuestion
                question={q}
                index={i}
                onChange={(updated) => updateQuestion(q.id, updated)}
                onRemove={() => removeQuestion(q.id)}
                t={t}
              />
            )}
          />
        )}
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewQuestions: Question[] = (getNode(nodeId)?.data as any)?.activeComment ?? []

  if (submitted) {
    return (
      <div className={s.root} style={cssVars}>
        <ThankYouScreen t={t} />
      </div>
    )
  }

  return (
    <div className={s.root} style={cssVars}>
      {viewQuestions.length === 0 ? (
        <p className={s.emptyHint}>{t('fbNoQuestions')}</p>
      ) : (
        <>
          <QuestionSlider
            questions={viewQuestions}
            isEditor={false}
            t={t}
            renderSlide={(q, i) => (
              <ViewQuestion
                question={q}
                index={i}
                answer={answers[q.id] ?? (q.type === 'multi' ? [] : '')}
                onAnswer={(val) => setAnswer(q.id, val)}
                t={t}
              />
            )}
          />

          <button
            className={`${s.submitBtn} ${submitting ? s.submitBtnLoading : ''}`}
            onClick={handleSubmit}
            disabled={submitting}
            type='button'
          >
            {submitting ? '...' : t('fbSubmit')}
          </button>
        </>
      )}
    </div>
  )
}
