/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {InfoAudioEditor} from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import {InfoMediaEditor} from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import {calculateResult, StudentAnswer, TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {
  ChooseOptionPayload,
  DialoguePayload,
  FreeAnswerPayload,
  MatchPairsPayload,
  SequencePayload,
  WordScramblePayload
} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {DialogueStudentView} from '@/widgets/Tasks/BlockEditor/DialogueEditor/DialogueEditor'
import {FillTextEditor} from '@/widgets/Tasks/BlockEditor/FillTextEditor/FillTextEditor'
import {HighlightStudentView} from '@/widgets/Tasks/BlockEditor/HighlightTextEditor/HighlightTextEditor'
import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'

import {InfoTextEditor} from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import {ChooseOptionStudent} from '@/widgets/Tasks/BlockEditor/ChooseOptionEditor/ChooseOptionStudent/ChooseOptionStudent'
import {FreeAnswerStudent} from '@/widgets/Tasks/BlockEditor/FreeAnswerEditor/FreeAnswerStudent/FreeAnswerStudent'
import {MatchPairsStudent} from '@/widgets/Tasks/BlockEditor/MatchPairsEditor/MatchPairsStudent/MatchPairsStudent'
import {SequenceStudent} from '@/widgets/Tasks/BlockEditor/SequenceEditor/SequenceStudent/SequenceStudent'
import {
  getShuffledItems,
  StudentViewWordScramble
} from '@/widgets/Tasks/BlockEditor/WordScrambleEditor/StudentViewWordScramble/StudentViewWordScramble'
import styles from './TestPlayer.module.scss'

export function BlockView({
  block,
  onChange,
  isSubmitted
}: {
  block: TestBlock
  onChange: (blockId: string, answer: StudentAnswer) => void
  isSubmitted: boolean
}) {
  const cb = (a: StudentAnswer) => onChange(block.id, a)
  const p = block.payload as any

  switch (block.type) {
    case TaskBlockType.CHOOSE_OPTION:
      return <ChooseOptionStudent payload={p as ChooseOptionPayload} onChange={cb} />
    case TaskBlockType.FREE_ANSWER:
      return <FreeAnswerStudent payload={p as FreeAnswerPayload} onChange={cb} />
    case TaskBlockType.SEQUENCE:
      return <SequenceStudent payload={p as SequencePayload} onChange={cb} />
    case TaskBlockType.MATCH_PAIRS:
      return <MatchPairsStudent payload={p as MatchPairsPayload} onChange={cb} />
    case TaskBlockType.HIGHLIGHT_TEXT:
      return (
        <HighlightStudentView
          instruction={p.instruction}
          tokens={p.tokens ?? []}
          onChange={(selected) => cb({type: TaskBlockType.HIGHLIGHT_TEXT, value: selected})}
          externalChecked={isSubmitted}
        />
      )
    case TaskBlockType.WORD_SCRAMBLE: {
      const wp = p as WordScramblePayload
      if (!wp.source) return null
      return (
        <StudentViewWordScramble
          source={wp.source}
          mode={wp.mode}
          hint={wp.hint}
          shuffledItems={getShuffledItems(wp.source, wp.mode)}
          onChange={cb}
          externalChecked={isSubmitted}
        />
      )
    }
    case TaskBlockType.DIALOGUE:
      return (
        <DialogueStudentView
          payload={p as DialoguePayload}
          onChange={(ids) => cb({type: TaskBlockType.DIALOGUE, value: ids})}
          externalChecked={isSubmitted}
        />
      )
    case TaskBlockType.INFO_TEXT:
      return <InfoTextEditor payload={p} viewOnly />
    case TaskBlockType.INFO_MEDIA:
      return <InfoMediaEditor payload={p} viewOnly />
    case TaskBlockType.INFO_AUDIO:
      return <InfoAudioEditor payload={p} viewOnly />
    case TaskBlockType.FILL_TEXT:
      return <FillTextEditor blockId={block.id} onlyPass onChangeAnswer={cb} payload={p} />
    default:
      return null
  }
}

// Types that require an answer from the student (info blocks are excluded)
const ANSWERABLE_TYPES = new Set<TaskBlockType>([
  TaskBlockType.CHOOSE_OPTION,
  TaskBlockType.FREE_ANSWER,
  TaskBlockType.SEQUENCE,
  TaskBlockType.MATCH_PAIRS,
  TaskBlockType.HIGHLIGHT_TEXT,
  TaskBlockType.WORD_SCRAMBLE,
  TaskBlockType.DIALOGUE,
  TaskBlockType.FILL_TEXT,
])

// ── BlockWrapper ──────────────────────────────────────────────────────────────

const BLOCK_LABEL_KEYS: Partial<Record<TaskBlockType, string>> = {
  [TaskBlockType.CHOOSE_OPTION]: 'labelChooseOption',
  [TaskBlockType.FREE_ANSWER]: 'labelFreeAnswer',
  [TaskBlockType.SEQUENCE]: 'labelSequence',
  [TaskBlockType.MATCH_PAIRS]: 'labelMatchPairs',
  [TaskBlockType.HIGHLIGHT_TEXT]: 'labelHighlightText',
  [TaskBlockType.WORD_SCRAMBLE]: 'labelWordScramble',
  [TaskBlockType.DIALOGUE]: 'labelDialogue',
  [TaskBlockType.FILL_TEXT]: 'labelFillText',
}

export function BlockWrapper({block, children, hasError}: {block: TestBlock; children: React.ReactNode; hasError?: boolean}) {
  const t = useTranslations('TestPlayer')
  const labelKey = BLOCK_LABEL_KEYS[block.type as TaskBlockType]
  if (!labelKey) return <>{children}</>
  return (
    <div className={`${styles.block_card} ${hasError ? styles.block_card_error : ''}`}>
      <span className={styles.block_label}>{t(labelKey as Parameters<typeof t>[0])}</span>
      {children}
    </div>
  )
}

// ── TestPlayer — переиспользуемый плеер ──────────────────────────────────────

interface TestPlayerProps {
  blocks: TestBlock[]
  // режим ноды — один блок за раз с навигацией
  singleBlock?: boolean
  // колбэк когда тест завершён
  onResult?: (result: TestResult) => void
  showInlineResult?: boolean
}

export function TestPlayer({blocks, singleBlock = false, onResult, showInlineResult}: TestPlayerProps) {
  const t = useTranslations('TestPlayer')
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map())
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [errorBlockIds, setErrorBlockIds] = useState<Set<string>>(new Set())

  const setAnswer = (blockId: string, answer: StudentAnswer) => {
    setAnswers((prev) => new Map(prev).set(blockId, answer))
    setErrorBlockIds((prev) => {
      if (!prev.has(blockId)) return prev
      const next = new Set(prev)
      next.delete(blockId)
      return next
    })
  }

  const handleSubmit = () => {
    const unanswered = blocks
      .filter((b) => ANSWERABLE_TYPES.has(b.type as TaskBlockType) && !answers.has(b.id))
      .map((b) => b.id)

    if (unanswered.length > 0) {
      setErrorBlockIds(new Set(unanswered))
      toast.error(t('unansweredError', {count: unanswered.length}))
      if (singleBlock) {
        const firstErrorIdx = blocks.findIndex((b) => unanswered.includes(b.id))
        if (firstErrorIdx !== -1) setActiveIdx(firstErrorIdx)
      }
      return
    }

    setIsSubmitted(true)
    const res = calculateResult(blocks, answers)
    onResult?.(res)
    if (showInlineResult) setResult(res)
  }

  const handleRetry = () => {
    setAnswers(new Map())
    setIsSubmitted(false)
    setResult(null)
    setActiveIdx(0)
    setErrorBlockIds(new Set())
  }

  if (blocks.length === 0) return null

  // ── Результат ──
  if (result && showInlineResult) {
    return <ResultView result={result} onRetry={handleRetry} />
  }

  if (singleBlock) {
    const current = blocks[activeIdx]
    const currentHasError = errorBlockIds.has(current.id)
    return (
      <div className={styles.single}>
        {/* Навигация */}
        <div className={styles.nav}>
          <button className={styles.nav_btn} disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => i - 1)}>
            ←
          </button>
          <div className={styles.pills}>
            {blocks.map((b, i) => (
              <button
                key={i}
                className={`${styles.pill} ${i === activeIdx ? styles.pill_active : ''} ${errorBlockIds.has(b.id) ? styles.pill_error : ''}`}
                onClick={() => setActiveIdx(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            className={styles.nav_btn}
            disabled={activeIdx === blocks.length - 1}
            onClick={() => setActiveIdx((i) => i + 1)}
          >
            →
          </button>
        </div>

        {/* Текущий блок */}
        <div key={current.id} className={`${styles.single_block_wrap} ${currentHasError ? styles.single_block_wrap_error : ''}`}>
          <BlockWrapper block={current} hasError={currentHasError}>
            <BlockView block={current} onChange={setAnswer} isSubmitted={isSubmitted} />
          </BlockWrapper>
        </div>

        {/* Кнопка завершения на последнем блоке */}
        {activeIdx === blocks.length - 1 && !isSubmitted && (
          <button className={styles.submit_btn} onClick={handleSubmit}>
            {t('submitBtn')}
          </button>
        )}
      </div>
    )
  }

  // ── Режим всех блоков (для TakeTestPage) ──
  return (
    <div className={styles.all}>
      <div className={styles.blocks}>
        {blocks.map((block) => (
          <div key={block.id} className={`${styles.block} ${errorBlockIds.has(block.id) ? styles.block_error : ''}`}>
            <BlockWrapper block={block} hasError={errorBlockIds.has(block.id)}>
              <BlockView block={block} onChange={setAnswer} isSubmitted={isSubmitted} />
            </BlockWrapper>
          </div>
        ))}
      </div>
      <button className={styles.submit_btn} onClick={handleSubmit}>
        {t('submitBtnAll')}
      </button>
    </div>
  )
}

const RADIUS = 48
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ResultView({result, onRetry}: {result: TestResult; onRetry: () => void}) {
  const t = useTranslations('TestPlayer')
  const {percent, totalScore, maxScore, blocks} = result
  const {key, color} = gradeKey(percent)
  const targetOffset = CIRCUMFERENCE * (1 - percent / 100)
  const [animOffset, setAnimOffset] = useState(CIRCUMFERENCE)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimOffset(targetOffset))
    return () => cancelAnimationFrame(id)
  }, [targetOffset])

  const msgKey = `msg${key.charAt(0).toUpperCase()}${key.slice(1)}` as `msg${Capitalize<typeof key>}`

  return (
    <div className={styles.result}>
      <div className={styles.ring_wrap}>
        <svg width="120" height="120" viewBox="0 0 120 120" className={styles.ring_svg}>
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#f0f0f0" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={RADIUS} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animOffset}
            transform="rotate(-90 60 60)"
            className={styles.ring_progress}
          />
        </svg>
        <span className={styles.pct} style={{color}}>{percent}%</span>
      </div>

      <span className={styles.grade_label} style={{color}}>{t(key)}</span>
      <span className={styles.grade_message}>{t(msgKey)}</span>
      <p className={styles.score}>{t('score', {score: totalScore, max: maxScore})}</p>

      <div className={styles.result_rows}>
        {blocks.map((br, i) => (
          <div key={br.blockId} className={`${styles.result_row} ${br.isCorrect ? styles.ok : styles.err}`}>
            <span className={styles.num}>{i + 1}</span>
            <span className={`${styles.badge} ${br.isCorrect ? styles.badge_ok : styles.badge_err}`}>
              {br.isCorrect ? '✓' : '✗'}
            </span>
            <span className={styles.pts}>{br.score}/{br.maxScore}</span>
          </div>
        ))}
      </div>

      <button className={styles.retry_btn} onClick={onRetry}>{t('retryBtn')}</button>
    </div>
  )
}

type GradeKey = 'excellent' | 'good' | 'satisfactory' | 'needsWork'

function gradeKey(percent: number): {key: GradeKey; color: string} {
  if (percent >= 90) return {key: 'excellent',     color: '#1D9E75'}
  if (percent >= 70) return {key: 'good',          color: '#378ADD'}
  if (percent >= 50) return {key: 'satisfactory',  color: '#EF9F27'}
  return                    {key: 'needsWork',      color: '#E24B4A'}
}
