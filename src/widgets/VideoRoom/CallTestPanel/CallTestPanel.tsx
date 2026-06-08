/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { TestBlock } from '@/entities/store/slices/tasksSlice.slice'
import { BlockView, BlockWrapper } from '@/_pages/TestPages/TestPlayer/TestPlayer'
import { StudentAnswer, calculateResult } from '@/features/Tasks/TaskResult/scoreBlock'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { ChooseOptionPayload, FreeAnswerPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { IconMinimize, IconXSmall } from '../icons'
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

/** Inverse of serializeAnswer — restores Map values for MATCH_PAIRS after JSON round-trip. */
export function deserializeAnswer(answer: any): StudentAnswer {
  if (answer?.type === TaskBlockType.MATCH_PAIRS && answer.value && !(answer.value instanceof Map)) {
    return { type: TaskBlockType.MATCH_PAIRS, value: new Map(Object.entries(answer.value)) }
  }
  return answer as StudentAnswer
}

/** Build a properly typed answers Map from a received AnswerRecord. */
export function answersToMap(rec: AnswerRecord): Map<string, StudentAnswer> {
  return new Map(Object.entries(rec).map(([k, v]) => [k, deserializeAnswer(v)]))
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
        <button className={styles.submitBtn} onClick={handleSubmit}>Сдать</button>
      </div>

      <div className={styles.blockArea}>
        {current && (
          <BlockWrapper block={current} hasError={errorIds.has(current.id)}>
            <BlockView block={current} onChange={handleAnswer} isSubmitted={false} />
          </BlockWrapper>
        )}
      </div>
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
  participants?: string[]
  onStop: () => void
  onHide?: () => void
}

export function CallTestTeacherView({ blocks, title, studentProgress, studentCount, isOneOnOne, studentIdentity, participants, onStop, onHide }: CallTestTeacherViewProps) {
  const answerableBlocks = blocks.filter(b => ANSWERABLE.has(b.type as string))
  const [activeIdx, setActiveIdx] = useState(0)
  const [showScores, setShowScores] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [modalStudent, setModalStudent] = useState<string | null>(null)

  const submitted = Object.values(studentProgress).filter(p => p.submitted).length
  const current = answerableBlocks[activeIdx]

  // All known participants: union of passed list + anyone who has sent answers
  const allIdentities = React.useMemo(() => {
    const set = new Set<string>([
      ...(participants ?? []),
      ...Object.keys(studentProgress),
    ])
    return Array.from(set)
  }, [participants, studentProgress])

  return (
    <div className={styles.teacherView}>
      {modalStudent && (
        <ParticipantAnswersModal
          identity={modalStudent}
          blocks={blocks}
          progress={studentProgress[modalStudent]}
          onClose={() => setModalStudent(null)}
        />
      )}

      <div className={styles.teacherHeader}>
        <div className={styles.teacherActions}>
          {onHide && (
            <button className={styles.hideBtn} onClick={onHide} title="Свернуть тест"><IconMinimize /></button>
          )}
          <button className={styles.stopBtn} onClick={onStop} title="Завершить тест"><IconXSmall /> Стоп</button>
        </div>
        <span className={styles.testTitle}>{title}</span>
        <span className={styles.submittedBadge}>{submitted}/{studentCount} сдали</span>
      </div>

      {allIdentities.length > 0 && (
        <div className={styles.participantStrip}>
          <button
            className={`${styles.partChip} ${!selectedStudent ? styles.partChipActive : ''}`}
            onClick={() => setSelectedStudent(null)}
          >
            Все
          </button>
          {allIdentities.map(identity => {
            const prog = studentProgress[identity]
            const hasSubmitted = prog?.submitted === true
            const hasAnswers = prog && Object.keys(prog.answers).length > 0
            let score: number | null = null
            if (hasSubmitted) {
              const answersMap = answersToMap(prog.answers)
              const res = calculateResult(blocks, answersMap)
              score = res.percent
            }
            const isActive = selectedStudent === identity
            return (
              <button
                key={identity}
                className={`${styles.partChip} ${isActive ? styles.partChipActive : ''} ${hasSubmitted ? styles.partChipSubmitted : hasAnswers ? styles.partChipInProgress : ''}`}
                onClick={() => {
                  setSelectedStudent(prev => prev === identity ? null : identity)
                  if (hasSubmitted) setModalStudent(identity)
                }}
                title={hasSubmitted ? 'Посмотреть ответы' : undefined}
              >
                <span className={styles.partChipName}>{identity.length > 12 ? identity.slice(0, 12) + '…' : identity}</span>
                {hasSubmitted && score !== null && <span className={styles.partChipScore}>{score}%</span>}
                {hasSubmitted && <span className={styles.partChipStatus}>✓</span>}
                {!hasSubmitted && hasAnswers && <span className={styles.partChipDot} />}
              </button>
            )
          })}
        </div>
      )}

      {answerableBlocks.length === 0 ? (
        <p className={styles.emptyNote}>Нет вопросов</p>
      ) : (
        <>
          <div className={styles.questionNav}>
            <button className={styles.navBtn} disabled={showScores || activeIdx === 0} onClick={() => setActiveIdx(i => i - 1)}>←</button>
            <div className={styles.pills}>
              {answerableBlocks.map((b, i) => (
                <button key={b.id} onClick={() => { setActiveIdx(i); setShowScores(false) }}
                  className={`${styles.pill} ${!showScores && i === activeIdx ? styles.pillActive : ''}`}
                >{i + 1}</button>
              ))}
              <button
                onClick={() => setShowScores(s => !s)}
                className={`${styles.pill} ${showScores ? styles.pillActive : ''}`}
                title="Итоги"
              >★</button>
            </div>
            <button className={styles.navBtn} disabled={showScores || activeIdx === answerableBlocks.length - 1} onClick={() => setActiveIdx(i => i + 1)}>→</button>
          </div>

          <div className={styles.statsArea}>
            {showScores ? (
              <ScoreDistributionView blocks={blocks} studentProgress={studentProgress} selectedStudent={selectedStudent} />
            ) : current && (
              selectedStudent
                ? <BlockLiveView block={current} progress={studentProgress[selectedStudent]} />
                : <BlockStatsView block={current} studentProgress={studentProgress} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Participant answers modal ─────────────────────────────────────────────────

interface ParticipantAnswersModalProps {
  identity: string
  blocks: TestBlock[]
  progress: StudentProgress | undefined
  onClose: () => void
}

function ParticipantAnswersModal({ identity, blocks, progress, onClose }: ParticipantAnswersModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const answerableBlocks = blocks.filter(b => ANSWERABLE.has(b.type as string))

  let scoreData: { percent: number; totalScore: number; maxScore: number } | null = null
  if (progress?.submitted) {
    const answersMap = answersToMap(progress.answers)
    const res = calculateResult(blocks, answersMap)
    scoreData = { percent: res.percent, totalScore: res.totalScore, maxScore: res.maxScore }
  }

  const { label, color } = scoreData ? gradeColor(scoreData.percent) : { label: '', color: '#94a3b8' }

  return (
    <div className={styles.modalOverlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{identity}</div>
          <button className={styles.modalClose} onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!progress?.submitted ? (
          <div className={styles.modalEmpty}>Участник ещё не сдал тест</div>
        ) : (
          <div className={styles.modalBody}>
            {scoreData && (
              <div className={styles.modalScore}>
                <div className={styles.modalRing} style={{ borderColor: color }}>
                  <span className={styles.modalRingPct} style={{ color }}>{scoreData.percent}%</span>
                  <span className={styles.modalRingLabel} style={{ color }}>{label}</span>
                </div>
                <span className={styles.modalScoreText}>{scoreData.totalScore} / {scoreData.maxScore} баллов</span>
              </div>
            )}

            {answerableBlocks.map((block, i) => (
              <div key={block.id} className={styles.modalQuestion}>
                <div className={styles.modalQNum}>Вопрос {i + 1}</div>
                <BlockLiveView block={block} progress={progress} />
              </div>
            ))}
          </div>
        )}
      </div>
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

// ── Score distribution (teacher overview / per-student result) ────────────────

function ScoreDistributionView({ blocks, studentProgress, selectedStudent }: {
  blocks: TestBlock[]
  studentProgress: Record<string, StudentProgress>
  selectedStudent: string | null
}) {
  const submittedEntries = Object.entries(studentProgress).filter(([, p]) => p.submitted)

  if (selectedStudent) {
    const progress = studentProgress[selectedStudent]
    if (!progress?.submitted) {
      return <div className={styles.statsBlock}><p className={styles.emptyNote}>Не сдал</p></div>
    }
    const answersMap = answersToMap(progress.answers)
    const res = calculateResult(blocks, answersMap)
    const { label } = gradeColor(res.percent)
    const answerableBlocks = blocks.filter(b => ANSWERABLE.has(b.type as string))
    return (
      <div className={styles.studentReview}>
        <div className={styles.studentResultRing}>
          <span className={styles.resultPct}>{res.percent}%</span>
          <span className={styles.resultLabel}>{label}</span>
        </div>
        <p className={styles.resultScore}>{res.totalScore} / {res.maxScore} баллов</p>
        {answerableBlocks.map((block, i) => (
          <div key={block.id} className={styles.reviewQuestionWrap}>
            <p className={styles.reviewQNum}>Вопрос {i + 1}</p>
            <BlockLiveView block={block} progress={progress} />
          </div>
        ))}
      </div>
    )
  }

  if (submittedEntries.length === 0) {
    return <div className={styles.statsBlock}><p className={styles.emptyNote}>Никто не сдал</p></div>
  }

  const buckets = [
    { label: 'Отлично', min: 90, count: 0 },
    { label: 'Хорошо',  min: 70, count: 0 },
    { label: 'Удовл.',  min: 50, count: 0 },
    { label: 'Слабо',   min:  0, count: 0 },
  ]
  for (const [, progress] of submittedEntries) {
    const answersMap = answersToMap(progress.answers)
    const res = calculateResult(blocks, answersMap)
    const bucket = buckets.find(b => res.percent >= b.min)
    if (bucket) bucket.count++
  }
  const max = Math.max(...buckets.map(b => b.count), 1)

  return (
    <div className={styles.statsBlock}>
      <p className={styles.statsQuestion}>Итоги теста</p>
      <div className={styles.bars}>
        {buckets.map(b => (
          <div key={b.label} className={styles.barRow}>
            <span className={styles.barLabel}>{b.label}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${(b.count / max) * 100}%`, background: '#334155' }} />
            </div>
            <span className={styles.barCount}>{b.count}</span>
          </div>
        ))}
      </div>
      <p className={styles.statsFooter}>Сдали: {submittedEntries.length} / {Object.keys(studentProgress).length}</p>
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
