/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useCallback } from 'react'
import { TestBlock } from '@/entities/store/slices/tasksSlice.slice'
import { BlockView, BlockWrapper } from '@/_pages/TestPages/TestPlayer/TestPlayer'
import { StudentAnswer, calculateResult } from '@/features/Tasks/TaskResult/scoreBlock'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { ChooseOptionPayload, FreeAnswerPayload } from '@/shared/types/Tasks/TaskPayload.type'
import styles from './CallTestPanel.module.scss'

export type AnswerRecord = Record<string, any>

export interface StudentProgress {
  answers: AnswerRecord
  submitted: boolean
}

export function serializeAnswer(answer: StudentAnswer): any {
  const a = answer as any
  if (a.value instanceof Map) return { type: a.type, value: Object.fromEntries(a.value) }
  return answer
}

const ANSWERABLE = new Set<string>([
  TaskBlockType.CHOOSE_OPTION, TaskBlockType.FREE_ANSWER,
  TaskBlockType.SEQUENCE, TaskBlockType.MATCH_PAIRS,
  TaskBlockType.HIGHLIGHT_TEXT, TaskBlockType.WORD_SCRAMBLE,
  TaskBlockType.DIALOGUE, TaskBlockType.FILL_TEXT,
])

// ── Student view ──────────────────────────────────────────────────────────────

interface CallTestStudentViewProps {
  blocks: TestBlock[]
  title: string
  onAnswer: (blockId: string, answer: StudentAnswer) => void
  onSubmit: (answers: AnswerRecord) => void
  submitted: boolean
}

export function CallTestStudentView({ blocks, title, onAnswer, onSubmit, submitted }: CallTestStudentViewProps) {
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map())
  const [activeIdx, setActiveIdx] = useState(0)
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<{ percent: number; score: number; max: number } | null>(null)

  const handleAnswer = useCallback((blockId: string, answer: StudentAnswer) => {
    setAnswers(prev => new Map(prev).set(blockId, answer))
    setErrorIds(prev => { const s = new Set(prev); s.delete(blockId); return s })
    onAnswer(blockId, answer)
  }, [onAnswer])

  const handleSubmit = useCallback(() => {
    const unanswered = blocks
      .filter(b => ANSWERABLE.has(b.type as string) && !answers.has(b.id))
      .map(b => b.id)
    if (unanswered.length > 0) { setErrorIds(new Set(unanswered)); return }

    const rec: AnswerRecord = {}
    for (const [k, v] of answers) rec[k] = v
    const res = calculateResult(blocks, answers)
    setResult({ percent: res.percent, score: res.totalScore, max: res.maxScore })
    onSubmit(rec)
  }, [blocks, answers, onSubmit])

  if (submitted && result) {
    const { label, color } = gradeColor(result.percent)
    return (
      <div className={styles.resultView}>
        <div className={styles.resultRing} style={{ borderColor: color }}>
          <span className={styles.resultPct} style={{ color }}>{result.percent}%</span>
          <span className={styles.resultLabel} style={{ color }}>{label}</span>
        </div>
        <p className={styles.resultScore}>{result.score} / {result.max} баллов</p>
        <p className={styles.resultNote}>Результат отправлен учителю</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={styles.resultView}>
        <div className={styles.resultCheck}>✓</div>
        <p className={styles.resultNote}>Ответы отправлены</p>
      </div>
    )
  }

  const answerableBlocks = blocks.filter(b => ANSWERABLE.has(b.type as string))
  const answeredCount = answerableBlocks.filter(b => answers.has(b.id)).length
  const current = blocks[activeIdx]

  return (
    <div className={styles.playerView}>
      <div className={styles.playerHeader}>
        <span className={styles.testTitle}>{title}</span>
        <span className={styles.progressBadge}>{answeredCount}/{answerableBlocks.length}</span>
      </div>

      <div className={styles.questionNav}>
        <button className={styles.navBtn} disabled={activeIdx === 0} onClick={() => setActiveIdx(i => i - 1)}>←</button>
        <div className={styles.pills}>
          {blocks.map((b, i) => (
            <button key={b.id} onClick={() => setActiveIdx(i)} className={[
              styles.pill,
              i === activeIdx ? styles.pillActive : '',
              errorIds.has(b.id) ? styles.pillError : '',
              answers.has(b.id) ? styles.pillDone : '',
            ].filter(Boolean).join(' ')}>{i + 1}</button>
          ))}
        </div>
        <button className={styles.navBtn} disabled={activeIdx === blocks.length - 1} onClick={() => setActiveIdx(i => i + 1)}>→</button>
      </div>

      <div className={styles.blockArea}>
        {current && (
          <BlockWrapper block={current} hasError={errorIds.has(current.id)}>
            <BlockView block={current} onChange={handleAnswer} isSubmitted={false} />
          </BlockWrapper>
        )}
      </div>

      {activeIdx === blocks.length - 1 && (
        <button className={styles.submitBtn} onClick={handleSubmit}>Отправить ответы</button>
      )}
    </div>
  )
}

// ── Teacher view ──────────────────────────────────────────────────────────────

interface CallTestTeacherViewProps {
  blocks: TestBlock[]
  title: string
  studentProgress: Record<string, StudentProgress>
  studentCount: number
  isOneOnOne: boolean
  studentIdentity?: string
  onStop: () => void
}

export function CallTestTeacherView({ blocks, title, studentProgress, studentCount, isOneOnOne, studentIdentity, onStop }: CallTestTeacherViewProps) {
  const answerableBlocks = blocks.filter(b => ANSWERABLE.has(b.type as string))
  const [activeIdx, setActiveIdx] = useState(0)
  const submitted = Object.values(studentProgress).filter(p => p.submitted).length
  const current = answerableBlocks[activeIdx]

  return (
    <div className={styles.teacherView}>
      <div className={styles.teacherHeader}>
        <span className={styles.testTitle}>{title}</span>
        <div className={styles.teacherMeta}>
          <span className={styles.submittedBadge}>{submitted}/{studentCount} сдали</span>
          <button className={styles.stopBtn} onClick={onStop} title="Завершить тест">✕ Стоп</button>
        </div>
      </div>

      {answerableBlocks.length === 0 ? (
        <p className={styles.emptyNote}>Нет вопросов</p>
      ) : (
        <>
          <div className={styles.questionNav}>
            <button className={styles.navBtn} disabled={activeIdx === 0} onClick={() => setActiveIdx(i => i - 1)}>←</button>
            <div className={styles.pills}>
              {answerableBlocks.map((b, i) => (
                <button key={b.id} onClick={() => setActiveIdx(i)}
                  className={`${styles.pill} ${i === activeIdx ? styles.pillActive : ''}`}
                >{i + 1}</button>
              ))}
            </div>
            <button className={styles.navBtn} disabled={activeIdx === answerableBlocks.length - 1} onClick={() => setActiveIdx(i => i + 1)}>→</button>
          </div>

          <div className={styles.statsArea}>
            {current && (isOneOnOne && studentIdentity
              ? <BlockLiveView block={current} progress={studentProgress[studentIdentity]} />
              : <BlockStatsView block={current} studentProgress={studentProgress} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Per-question bar chart (multi-student) ────────────────────────────────────

function BlockStatsView({ block, studentProgress }: { block: TestBlock; studentProgress: Record<string, StudentProgress> }) {
  const allAnswers = Object.values(studentProgress).map(s => s.answers[block.id]).filter(a => a !== undefined)

  if (block.type === TaskBlockType.CHOOSE_OPTION) {
    const p = block.payload as ChooseOptionPayload
    const counts: Record<string, number> = {}
    for (const opt of p.options) counts[opt.id] = 0
    for (const ans of allAnswers) {
      const val = (ans as any)?.value
      const ids: string[] = Array.isArray(val) ? val : [val]
      for (const id of ids) if (id && counts[id] !== undefined) counts[id]++
    }
    const max = Math.max(...Object.values(counts), 1)
    const correctIds = Array.isArray(p.correctId) ? p.correctId : [p.correctId]

    return (
      <div className={styles.statsBlock}>
        <p className={styles.statsQuestion}>{p.question}</p>
        <div className={styles.bars}>
          {p.options.map(opt => {
            const count = counts[opt.id] ?? 0
            const isCorrect = correctIds.includes(opt.id)
            return (
              <div key={opt.id} className={styles.barRow}>
                <span className={styles.barLabel}>{opt.text}</span>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${isCorrect ? styles.barCorrect : styles.barWrong}`}
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className={styles.barCount}>{count}</span>
                {isCorrect && <span className={styles.correctMark}>✓</span>}
              </div>
            )
          })}
        </div>
        <p className={styles.statsFooter}>Ответили: {allAnswers.length}</p>
      </div>
    )
  }

  if (block.type === TaskBlockType.FREE_ANSWER) {
    const p = block.payload as FreeAnswerPayload
    const items = Object.entries(studentProgress)
      .map(([name, s]) => ({ name, text: (s.answers[block.id] as any)?.value as string | undefined }))
      .filter(a => a.text)
    return (
      <div className={styles.statsBlock}>
        <p className={styles.statsQuestion}>{p.question}</p>
        <div className={styles.freeList}>
          {items.length === 0 && <p className={styles.statsFooter}>Нет ответов</p>}
          {items.map(({ name, text }, i) => (
            <div key={i} className={styles.freeItem}>
              <span className={styles.freeName}>{name}:</span>
              <span className={styles.freeText}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.statsBlock}>
      <p className={styles.statsFooter}>Ответили: {allAnswers.length}</p>
    </div>
  )
}

// ── Live view (1-on-1: teacher sees student's real-time selection) ─────────────

function BlockLiveView({ block, progress }: { block: TestBlock; progress: StudentProgress | undefined }) {
  const ans = progress?.answers[block.id] as any

  if (block.type === TaskBlockType.CHOOSE_OPTION) {
    const p = block.payload as ChooseOptionPayload
    const val = ans?.value
    const correctIds = Array.isArray(p.correctId) ? p.correctId : [p.correctId]
    return (
      <div className={styles.statsBlock}>
        <p className={styles.statsQuestion}>{p.question}</p>
        <div className={styles.liveOptions}>
          {p.options.map(opt => {
            const sel = val === opt.id || (Array.isArray(val) && val.includes(opt.id))
            const correct = correctIds.includes(opt.id)
            return (
              <div key={opt.id} className={[
                styles.liveOption,
                sel ? styles.liveSelected : '',
                sel && correct ? styles.liveCorrect : '',
                sel && !correct ? styles.liveWrong : '',
              ].filter(Boolean).join(' ')}>
                {opt.text}
                {correct && <span className={styles.correctMark}>✓</span>}
              </div>
            )
          })}
        </div>
        {!ans && <p className={styles.statsFooter}>Не ответил</p>}
        {progress?.submitted && <p className={styles.submittedNote}>✓ Сдал</p>}
      </div>
    )
  }

  if (block.type === TaskBlockType.FREE_ANSWER) {
    const p = block.payload as FreeAnswerPayload
    const text = ans?.value as string | undefined
    return (
      <div className={styles.statsBlock}>
        <p className={styles.statsQuestion}>{p.question}</p>
        {text
          ? <div className={styles.freeItem}><span className={styles.freeText}>{text}</span></div>
          : <p className={styles.statsFooter}>Не ответил</p>
        }
        {progress?.submitted && <p className={styles.submittedNote}>✓ Сдал</p>}
      </div>
    )
  }

  return (
    <div className={styles.statsBlock}>
      {ans ? <p className={styles.statsFooter}>Ответил</p> : <p className={styles.statsFooter}>Не ответил</p>}
      {progress?.submitted && <p className={styles.submittedNote}>✓ Сдал</p>}
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function gradeColor(percent: number) {
  if (percent >= 90) return { label: 'Отлично', color: '#1D9E75' }
  if (percent >= 70) return { label: 'Хорошо', color: '#378ADD' }
  if (percent >= 50) return { label: 'Удовл.', color: '#EF9F27' }
  return { label: 'Слабо', color: '#E24B4A' }
}
