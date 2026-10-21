'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { ChessBoard, type BoardMove } from '@/widgets/Chess/Board'
import { useChessActivity, todayLocal } from '@/widgets/Chess/Progress'
import { readPref } from '@/shared/lib/chess/localPref'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { playMoveSound } from '@/shared/lib/chess/sound'
import { isCleanSolve, playerColor, replyMove, soundKind, startRun, tryMove, type PuzzleRun, type Sq } from '../Puzzles/puzzleRun'
import styles from './ChessHubPage.module.scss'

type Puzzle = { id: string; fen: string; moves: string[]; rating: number }
type Daily = { day: string; puzzle: Puzzle; result?: 'solved' | 'failed' }
const KEY = 'gw-chess-daily'
const REPLY_MS = 450

const save = (d: Daily) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {}
}

/**
 * One puzzle a day on the hub, solved right on the card. The first puzzle served on a local day is kept
 * for that day (`localStorage['gw-chess-daily']`); the attempt counts like any puzzle — first try only.
 * ponytail: "daily" is per browser, not one puzzle for everyone; a shared one needs a server pick.
 */
export function DailyPuzzle() {
  const t = useTranslations('chess.play')
  const tl = useTranslations('chess.learn')
  const report = useChessActivity()
  const [daily, setDaily] = useState<Daily | null>(null)
  const [failed, setFailed] = useState(false)
  const [run, setRun] = useState<PuzzleRun | null>(null)
  const [wrong, setWrong] = useState<Sq | null>(null)
  const [busy, setBusy] = useState(false) // the opponent is answering
  const sent = useRef(false)
  const gen = useRef(0)

  useEffect(() => {
    const today = todayLocal()
    const g = gen
    let live = true
    let cached: Daily | null = null
    try {
      cached = JSON.parse(readPref(KEY) ?? 'null')
    } catch {}
    if (cached?.day === today && cached.puzzle?.moves?.length) {
      sent.current = !!cached.result
      setDaily(cached)
      if (!cached.result) setRun(startRun(cached.puzzle))
    } else
      fetch('/api/chess/puzzles/next')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((b: { puzzle: Puzzle }) => {
          if (!live) return
          const d: Daily = { day: today, puzzle: b.puzzle }
          save(d)
          setDaily(d)
          setRun(startRun(b.puzzle))
        })
        .catch(() => live && setFailed(true))
    return () => {
      live = false
      g.current++
    }
  }, [])

  const attempt = (p: Puzzle, solved: boolean) => {
    if (sent.current) return
    sent.current = true
    if (solved) report({ kind: 'puzzle' })
    // a guest gets 401: nothing to keep
    fetch(`/api/chess/puzzles/${encodeURIComponent(p.id)}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solved }),
    }).catch(() => {})
  }

  const onMove = (m: BoardMove) => {
    if (!daily || !run || busy || daily.result) return
    const uci = m.from + m.to + (m.promotion ?? '')
    const res = tryMove(run, uci)
    if (!res.ok) {
      setWrong({ from: m.from, to: m.to })
      setRun(res.run)
      attempt(daily.puzzle, false)
      return
    }
    playMoveSound(soundKind(run.fen, uci))
    setWrong(null)
    setRun(res.run)
    if (res.done) {
      const clean = isCleanSolve(res.run)
      attempt(daily.puzzle, clean)
      const d: Daily = { ...daily, result: clean ? 'solved' : 'failed' }
      save(d)
      setDaily(d)
      return
    }
    setBusy(true)
    const my = gen.current
    setTimeout(() => {
      if (my !== gen.current) return
      playMoveSound(soundKind(res.run.fen, res.run.solution[res.run.ply]))
      setRun(replyMove(res.run))
      setBusy(false)
    }, REPLY_MS)
  }

  const p = daily?.puzzle
  const me = p ? playerColor(p) : 'w'
  const fen = run?.fen ?? (p ? startRun(p).fen : null)
  const highlights: Record<string, string> = wrong ? { [wrong.to]: 'rgba(200, 44, 44, 0.42)' } : {}
  const status = daily?.result
    ? t(daily.result === 'solved' ? 'sh_daily_solved' : 'sh_daily_failed')
    : wrong
    ? tl('pz_status_wrong')
    : tl(me === 'w' ? 'pz_status_turn_w' : 'pz_status_turn_b')

  return (
    <>
      <div className={styles.cardBoard}>
        {fen ? (
          <ChessBoard
            fen={fen}
            orientation={me}
            onMove={onMove}
            interactive={!!run && !busy && !daily?.result}
            lastMove={run?.lastMove ?? null}
            check={checkSquare(fen)}
            highlights={highlights}
            coords={false}
          />
        ) : (
          <div className={styles.boardGhost} aria-busy={!failed} />
        )}
      </div>
      <p className={styles.caption} data-tone={daily?.result === 'solved' ? 'ok' : wrong ? 'bad' : undefined} aria-live="polite">
        {daily?.result === 'solved' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
        <span className={styles.captionKey}>{t('sh_daily')}</span>
        <span>{failed ? tl('pz_error_title') : p ? status : tl('pz_status_loading')}</span>
      </p>
    </>
  )
}
