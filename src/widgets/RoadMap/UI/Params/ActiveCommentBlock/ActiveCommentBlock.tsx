// ActiveCommentBlock.tsx
// Режим создания (isView=false): репетитор создаёт вопросы — листает через Swiper, данные в nodeData.activeComment
// Режим прохождения (isView=true / onlyPass=true): студент отвечает, читает из nodeData.activeComment

import {getNodeHeaderIconColor} from '@/shared/helpers/Node/getNodeHeaderIconColor'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useReactFlow} from '@xyflow/react'
import {useCallback, useMemo, useRef, useState} from 'react'
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
  if (!headerColor) return {}
  const textColor = getNodeHeaderIconColor(headerColor) ?? '#2d3354'
  return {
    '--accent-bg': headerColor,
    '--accent-text': textColor,
  } as React.CSSProperties
}

// ─────────────────────────── Helpers ───────────────────────────

const uid = () => Math.random().toString(36).slice(2, 8)

const defaultT = (key: string): string => {
  const map: Record<string, string> = {
    addQuestion:         '+ Добавить вопрос',
    questionPlaceholder: 'Введите текст вопроса...',
    optionPlaceholder:   'Вариант ответа...',
    addOption:           '+ Вариант',
    single:              'Один ответ',
    multi:               'Несколько ответов',
    free:                'Свободный ответ',
    submit:              'Отправить ответы',
    submitted:           'Ответы отправлены ✓',
    noQuestions:         'Вопросы ещё не добавлены',
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
          {t(tp)}
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
        placeholder={t('questionPlaceholder')}
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
                title='Отметить правильным'
              >
                {opt.isCorrect ? '✓' : '○'}
              </button>

              <input
                className={s.optionInput}
                value={opt.text}
                onChange={(e) => updateOption(opt.id, {text: e.target.value})}
                placeholder={`${t('optionPlaceholder')} ${i + 1}`}
              />

              <button className={s.removeBtn} onClick={() => removeOption(opt.id)} type='button'>✕</button>
            </div>
          ))}

          <button className={s.addOptionBtn} onClick={addOption} type='button'>
            {t('addOption')}
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
}: {
  question: Question
  index: number
  answer: string | string[]
  onAnswer: (val: string | string[]) => void
}) {
  const toggleMulti = (id: string) => {
    const arr = Array.isArray(answer) ? answer : []
    onAnswer(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  return (
    <div className={s.viewQuestion}>
      <p className={s.viewQuestionText}>
        <span className={s.viewIndex}>{index + 1}.</span>{' '}
        {question.text || <em style={{opacity: 0.4}}>Вопрос без текста</em>}
      </p>

      {question.type === 'free' && (
        <textarea
          className={s.freeTextarea}
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder='Введите ваш ответ...'
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
                {opt.text || <em style={{opacity: 0.4}}>Вариант</em>}
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
                {opt.text || <em style={{opacity: 0.4}}>Вариант</em>}
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
            aria-label='Назад'
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
            aria-label='Вперёд'
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
            + Вопрос
          </button>
        )}
      </div>
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

  const {getNode, updateNodeData} = useReactFlow()

  // ── Read questions from nodeData.activeComment ──
  const nodeData = getNode(nodeId)?.data as (RoadNodeData & {activeComment?: Question[]}) | undefined
  const savedQuestions: Question[] = nodeData?.activeComment ?? []

  // Editor local state — initialised from nodeData.activeComment
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

  const setAnswer = (qId: string, val: string | string[]) =>
    setAnswers((prev) => ({...prev, [qId]: val}))

  const handleSubmit = () => {
    console.log('Submitted answers for node', nodeId, answers)
    setSubmitted(true)
  }

  // ── EDITOR MODE ──
  if (!isView) {
    return (
      <div className={s.root} style={cssVars}>
        <div className={s.editorLabel}>
          <span>✏️</span> Редактор теста
        </div>

        {questions.length === 0 ? (
          <>
            <p className={s.emptyHint}>{t('noQuestions')}</p>
            <button className={s.addQuestionBtn} onClick={addQuestion} type='button'>
              {t('addQuestion')}
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

  return (
    <div className={s.root} style={cssVars}>
      {viewQuestions.length === 0 ? (
        <p className={s.emptyHint}>{t('noQuestions')}</p>
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
              />
            )}
          />

          <button
            className={`${s.submitBtn} ${submitted ? s.submitBtnDone : ''}`}
            onClick={handleSubmit}
            disabled={submitted}
            type='button'
          >
            {submitted ? t('submitted') : t('submit')}
          </button>
        </>
      )}
    </div>
  )
}