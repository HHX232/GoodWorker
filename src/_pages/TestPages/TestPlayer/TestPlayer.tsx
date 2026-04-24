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
import {useState} from 'react'

import {ChooseOptionStudent} from '@/widgets/Tasks/BlockEditor/ChooseOptionEditor/ChooseOptionStudent/ChooseOptionStudent'
import {FreeAnswerStudent} from '@/widgets/Tasks/BlockEditor/FreeAnswerEditor/FreeAnswerStudent/FreeAnswerStudent'
import {MatchPairsStudent} from '@/widgets/Tasks/BlockEditor/MatchPairsEditor/MatchPairsStudent/MatchPairsStudent'
import {SequenceStudent} from '@/widgets/Tasks/BlockEditor/SequenceEditor/SequenceStudent/SequenceStudent'
import {
  getShuffledItems,
  StudentViewWordScramble
} from '@/widgets/Tasks/BlockEditor/WordScrambleEditor/StudentViewWordScramble/StudentViewWordScramble'
import styles from './TestPlayer.module.scss'
import {InfoTextEditor} from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'

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
      return <InfoTextEditor blockId={block.id} payload={p} viewOnly />
    case TaskBlockType.INFO_MEDIA:
      return <InfoMediaEditor blockId={block.id} payload={p} viewOnly />
    case TaskBlockType.INFO_AUDIO:
      return <InfoAudioEditor blockId={block.id} payload={p} viewOnly />
    case TaskBlockType.FILL_TEXT:
      return <FillTextEditor blockId={block.id} onlyPass onChangeAnswer={cb} payload={p} />
    default:
      return null
  }
}

// ── BlockWrapper ──────────────────────────────────────────────────────────────

const BLOCK_LABELS: Partial<Record<TaskBlockType, string>> = {
  [TaskBlockType.CHOOSE_OPTION]: 'Выберите вариант ответа',
  [TaskBlockType.FREE_ANSWER]: 'Напишите ответ',
  [TaskBlockType.SEQUENCE]: 'Расставьте в правильном порядке',
  [TaskBlockType.MATCH_PAIRS]: 'Сопоставьте пары',
  [TaskBlockType.HIGHLIGHT_TEXT]: 'Выделите правильные слова',
  [TaskBlockType.WORD_SCRAMBLE]: 'Составьте слово / предложение',
  [TaskBlockType.DIALOGUE]: 'Расставьте диалог в верном порядке',
  [TaskBlockType.FILL_TEXT]: 'Заполните пропуски'
}

export function BlockWrapper({block, children}: {block: TestBlock; children: React.ReactNode}) {
  const label = BLOCK_LABELS[block.type as TaskBlockType]
  if (!label) return <>{children}</>
  return (
    <div className={styles.block_card}>
      <span className={styles.block_label}>{label}</span>
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
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map())
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const setAnswer = (blockId: string, answer: StudentAnswer) => setAnswers((prev) => new Map(prev).set(blockId, answer))

  const handleSubmit = () => {
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
  }

  if (blocks.length === 0) return null

  // ── Результат ──
  if (result && showInlineResult) {
    const percent = result.percent
    const {label, color} = grade(percent)
    return (
      <div className={styles.result}>
        <div className={styles.ring} style={{borderColor: color}}>
          <span className={styles.pct} style={{color}}>
            {percent}%
          </span>
          <span className={styles.lbl} style={{color}}>
            {label}
          </span>
        </div>
        <p className={styles.score}>
          {result.totalScore} / {result.maxScore} баллов
        </p>
        <div className={styles.result_rows}>
          {result.blocks.map((br, i) => (
            <div key={br.blockId} className={`${styles.result_row} ${br.isCorrect ? styles.ok : styles.err}`}>
              <span className={styles.num}>{i + 1}</span>
              <span className={`${styles.badge} ${br.isCorrect ? styles.badge_ok : styles.badge_err}`}>
                {br.isCorrect ? '✓' : '✗'}
              </span>
              <span className={styles.pts}>
                {br.score}/{br.maxScore}
              </span>
            </div>
          ))}
        </div>
        <button className={styles.retry_btn} onClick={handleRetry}>
          Пройти снова
        </button>
      </div>
    )
  }

  if (singleBlock) {
    const current = blocks[activeIdx]
    return (
      <div className={styles.single}>
        {/* Навигация */}
        <div className={styles.nav}>
          <button className={styles.nav_btn} disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => i - 1)}>
            ←
          </button>
          <div className={styles.pills}>
            {blocks.map((_, i) => (
              <button
                key={i}
                className={`${styles.pill} ${i === activeIdx ? styles.pill_active : ''}`}
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
        <BlockWrapper block={current}>
          <BlockView block={current} onChange={setAnswer} isSubmitted={isSubmitted} />
        </BlockWrapper>

        {/* Кнопка завершения на последнем блоке */}
        {activeIdx === blocks.length - 1 && !isSubmitted && (
          <button className={styles.submit_btn} onClick={handleSubmit}>
            Завершить
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
          <div key={block.id} className={styles.block}>
            <BlockWrapper block={block}>
              <BlockView block={block} onChange={setAnswer} isSubmitted={isSubmitted} />
            </BlockWrapper>
          </div>
        ))}
      </div>
      <button className={styles.submit_btn} onClick={handleSubmit}>
        Завершить тест
      </button>
    </div>
  )
}

function grade(percent: number) {
  if (percent >= 90) return {label: 'Отлично', color: '#1D9E75'}
  if (percent >= 70) return {label: 'Хорошо', color: '#378ADD'}
  if (percent >= 50) return {label: 'Удовлетворительно', color: '#EF9F27'}
  return {label: 'Нужно повторить', color: '#E24B4A'}
}
