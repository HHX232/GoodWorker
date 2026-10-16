'use client'
import {ChessPuzzleAnswer, checkPuzzleMove, checkSquare, playUci} from '@/shared/lib/chess/puzzle'
import {playMoveSound} from '@/shared/lib/chess/sound'
import {ChessPuzzlePayload, ChessStudyPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {ChessBoard, type BoardMove} from '@/widgets/Chess/Board'
import {ChevronFirst, ChevronLeft, ChevronRight} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react'
import {moveNumber} from './ChessEditor'
import styles from './ChessEditor.module.scss'

const REPLY_DELAY_MS = 450
const WRONG_TINT = 'rgba(226, 75, 74, 0.45)'

const soundFor = (san: string) => (san.includes('#') ? 'end' : san.includes('+') ? 'check' : san.includes('x') ? 'capture' : 'move')
const turnOf = (fen: string): 'w' | 'b' => (fen.split(' ')[1] === 'b' ? 'b' : 'w')

type Status = 'idle' | 'wrong' | 'right' | 'solved'

// ── CHESS_PUZZLE: student plays the solution ───────────────────────────────────

export function ChessPuzzleStudent({
  payload,
  onChange,
  disabled
}: {
  payload: ChessPuzzlePayload
  onChange: (answer: ChessPuzzleAnswer) => void
  disabled?: boolean
}) {
  const t = useTranslations('chess.course')
  const [fen, setFen] = useState(payload.fen)
  const [ply, setPly] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [status, setStatus] = useState<Status>('idle')
  const [lastMove, setLastMove] = useState<{from: string; to: string} | null>(null)
  const [wrong, setWrong] = useState<Record<string, string> | undefined>()
  const [replying, setReplying] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const orientation = turnOf(payload.fen)

  const onMove = (m: BoardMove) => {
    if (disabled || replying || status === 'solved') return
    const uci = m.from + m.to + (m.promotion ?? '')
    const step = checkPuzzleMove(fen, payload.solution, ply, uci)
    if (!step.ok) {
      setMistakes(mistakes + 1)
      setStatus('wrong')
      setWrong({[m.from]: WRONG_TINT, [m.to]: WRONG_TINT})
      onChange({done: false, mistakes: mistakes + 1})
      return
    }
    const played = playUci(fen, uci)!
    playMoveSound(soundFor(played.san))
    setFen(played.fen)
    setLastMove({from: played.from, to: played.to})
    setWrong(undefined)
    if (step.done) {
      setStatus('solved')
      onChange({done: true, mistakes})
      return
    }
    setStatus('right')
    onChange({done: false, mistakes})
    const reply = step.reply && playUci(played.fen, step.reply)
    if (!reply) return
    setReplying(true)
    timer.current = setTimeout(() => {
      playMoveSound(soundFor(reply.san))
      setFen(reply.fen)
      setLastMove({from: reply.from, to: reply.to})
      setPly(ply + 2)
      setReplying(false)
    }, REPLY_DELAY_MS)
  }

  const message =
    status === 'solved'
      ? t(mistakes ? 'puzzleSolvedMistakes' : 'puzzleSolved')
      : status === 'wrong'
        ? t('puzzleWrong')
        : status === 'right'
          ? t('puzzleRight')
          : t('puzzleIdle')

  return (
    <div className={styles.player}>
      {payload.prompt?.trim() && <p className={styles.prompt}>{payload.prompt}</p>}
      <div className={styles.player_board}>
        <ChessBoard
          fen={fen}
          orientation={orientation}
          onMove={onMove}
          interactive={!disabled && !replying && status !== 'solved'}
          lastMove={lastMove}
          highlights={wrong}
          check={checkSquare(fen)}
        />
      </div>
      <div className={styles.status_row}>
        <span className={`${styles.turn_dot} ${orientation === 'b' ? styles.turn_black : ''}`} aria-hidden='true' />
        <span className={styles.turn_label}>{t(orientation === 'w' ? 'toMoveWhite' : 'toMoveBlack')}</span>
        <span
          role='status'
          className={`${styles.status} ${status === 'wrong' ? styles.status_wrong : ''} ${status === 'solved' ? (mistakes ? styles.status_wrong : styles.status_ok) : ''}`}
        >
          {message}
        </span>
      </div>
    </div>
  )
}

// ── CHESS_STUDY: student steps through the commented line ─────────────────────

export function ChessStudyStudent({payload}: {payload: ChessStudyPayload}) {
  const t = useTranslations('chess.course')
  const [idx, setIdx] = useState(0)

  const steps = useMemo(() => {
    let cur = payload.fen
    const out: {fen: string; from: string; to: string; san: string; comment?: string}[] = []
    for (const m of payload.moves) {
      const r = playUci(cur, m.uci)
      if (!r) break
      out.push({...r, comment: m.comment})
      cur = r.fen
    }
    return out
  }, [payload])

  const total = steps.length
  const cur = idx > 0 ? steps[idx - 1] : null
  const fen = cur?.fen ?? payload.fen
  const turn = turnOf(payload.fen)

  const go = (next: number) => {
    const n = Math.max(0, Math.min(total, next))
    if (n === idx) return
    if (n === idx + 1) playMoveSound(soundFor(steps[n - 1].san))
    setIdx(n)
  }

  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = {ArrowLeft: idx - 1, ArrowRight: idx + 1, Home: 0, End: total}
    if (e.key in map) {
      e.preventDefault()
      go(map[e.key])
    }
  }

  return (
    <div className={styles.player} tabIndex={0} onKeyDown={onKey}>
      <div className={styles.player_board}>
        <ChessBoard
          fen={fen}
          orientation={turn}
          interactive={false}
          lastMove={cur ? {from: cur.from, to: cur.to} : null}
          arrows={cur ? [{from: cur.from, to: cur.to}] : undefined}
          check={checkSquare(fen)}
        />
      </div>

      <div className={styles.study_nav}>
        <button type='button' className={styles.icon_btn} aria-label={t('toStart')} disabled={idx === 0} onClick={() => go(0)}>
          <ChevronFirst size={18} />
        </button>
        <button type='button' className={styles.icon_btn} aria-label={t('prev')} disabled={idx === 0} onClick={() => go(idx - 1)}>
          <ChevronLeft size={18} />
        </button>
        <span className={styles.study_counter}>{idx === 0 ? t('studyStart') : t('studyMoveOf', {n: idx, total})}</span>
        <button type='button' className={styles.icon_btn} aria-label={t('next')} disabled={idx === total} onClick={() => go(idx + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className={styles.study_comment} aria-live='polite'>
        {cur ? (
          <>
            <span className={`${styles.comment_san} ${styles.mono}`}>
              {moveNumber(idx - 1, turn) || `${Math.floor((idx - 1 + (turn === 'b' ? 1 : 0)) / 2) + 1}…`} {cur.san}
            </span>
            {cur.comment?.trim() && <p className={styles.comment_text}>{cur.comment}</p>}
          </>
        ) : (
          <span className={styles.turn_label}>{t(turn === 'w' ? 'toMoveWhite' : 'toMoveBlack')}</span>
        )}
      </div>

      {total > 0 && (
        <ol className={styles.study_moves}>
          {steps.map((s, i) => (
            <li key={i}>
              <button
                type='button'
                aria-current={i + 1 === idx ? 'step' : undefined}
                className={`${styles.study_move} ${i + 1 === idx ? styles.study_move_active : ''}`}
                onClick={() => go(i + 1)}
              >
                {moveNumber(i, turn) && <span className={styles.chip_num}>{moveNumber(i, turn)}</span>}
                <span className={styles.mono}>{s.san}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
