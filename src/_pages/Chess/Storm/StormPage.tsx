'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, LogIn, RotateCcw, SearchX, Trophy, X, Zap } from 'lucide-react'
import { ChessBoard, type BoardMove } from '@/widgets/Chess/Board'
import { playMoveSound } from '@/shared/lib/chess/sound'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import type { ChessProgressDto } from '@/shared/lib/chess/server/progress'
import { BadgeMedal, StreakFlame, badgeText, setMyChessProgress, useMyChessProgress } from '@/widgets/Chess/Progress'
import { playerColor, replyMove, soundKind, startRun, tryMove, type PuzzleRun, type Sq } from '../Puzzles/puzzleRun'
import { STORM_MAX_ERRORS, miss, solve, startStorm, stormMinRating, tick, timeLeftMs, type StormMode, type StormState } from './stormModel'
import styles from './Storm.module.scss'

type Puzzle = { id: string; fen: string; moves: string[]; rating: number }
type Saved = { state: 'saving' } | { state: 'error' } | { state: 'done'; best: number; record: boolean; newBadges: string[] }

const REPLY_MS = 220 // the opponent answers quicker than in the solver: the clock is running
const NEXT_MS = 420 // a beat on a wrong move before the next puzzle
const MODES: StormMode[] = [3, 5]
// a quiet middlegame for the start screen
const INTRO_FEN = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R2QKB1R w KQ - 0 9'

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function StormPage() {
  const t = useTranslations('chess.storm')
  const tp = useTranslations('chess.progress')
  const th = useTranslations('chess.play')
  const { status: auth } = useSession()
  const me = useMyChessProgress()

  const [mode, setMode] = useState<StormMode>(3)
  const [storm, setStorm] = useState<StormState | null>(null)
  const [now, setNow] = useState(0)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [run, setRun] = useState<PuzzleRun | null>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'play' | 'wait' | 'error'>('idle')
  const [wrong, setWrong] = useState<Sq | null>(null)
  const [log, setLog] = useState<{ id: string; rating: number; ok: boolean }[]>([])
  const [penaltyKey, setPenaltyKey] = useState(0) // re-mounts the "−10 s" flash
  const [saved, setSaved] = useState<Saved | null>(null)

  const gen = useRef(0) // bumps per run and per puzzle: late timers and fetches are dropped
  const seen = useRef<string[]>([])
  const postedRun = useRef<number | null>(null)
  const prefetched = useRef<{ index: number; p: Promise<Puzzle | null> } | null>(null)

  const fetchPuzzle = (index: number): Promise<Puzzle | null> => {
    const q = new URLSearchParams({ minRating: String(stormMinRating(index)) })
    if (seen.current.length) q.set('exclude', seen.current.slice(-300).join(','))
    return fetch(`/api/chess/puzzles/next?${q}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ puzzle: Puzzle }>) : null))
      .then((b) => b?.puzzle ?? null)
      .catch(() => null)
  }
  // the next puzzle is asked for while the current one is solved: no waiting on the clock
  const prefetch = (index: number) => {
    const p = fetchPuzzle(index)
    p.then((x) => x && seen.current.push(x.id))
    prefetched.current = { index, p }
  }
  const take = (index: number) => {
    const ready = prefetched.current?.index === index ? prefetched.current.p : null
    prefetched.current = null
    if (ready) return ready
    const p = fetchPuzzle(index)
    p.then((x) => x && seen.current.push(x.id))
    return p
  }

  const show = useCallback((index: number) => {
    const my = ++gen.current
    setPhase('loading')
    setWrong(null)
    void take(index).then((p) => {
      if (my !== gen.current) return
      if (!p) return setPhase('error')
      setPuzzle(p)
      setRun(null)
      prefetch(index + 1)
      setTimeout(() => {
        if (my !== gen.current) return
        setRun(startRun(p))
        setPhase('play')
        playMoveSound(soundKind(p.fen, p.moves[0]))
      }, REPLY_MS)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- take/prefetch only touch refs
  }, [])

  // first puzzle is fetched on the start screen, so the clock starts on a ready board
  useEffect(() => {
    prefetch(0)
    const g = gen
    return () => void g.current++
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const begin = (m: StormMode) => {
    const at = new Date().getTime() // event handler; the purity rule misreads it as render
    setMode(m)
    setStorm(startStorm(m, at))
    setNow(at)
    setLog([])
    setSaved(null)
    show(0)
  }

  // ─── clock ──────────────────────────────────────────────────────────────────
  const running = !!storm && !storm.over
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const at = Date.now()
      setNow(at)
      setStorm((s) => (s ? tick(s, at) : s))
    }, 200)
    return () => clearInterval(id)
  }, [running])

  // ─── end of run: save the score (guests: nothing is saved) ──────────────────
  // after the end neither changes: the effect runs once per run
  const final = storm?.over ? { mode: storm.mode, score: storm.score, run: storm.startedAt } : null
  const finalMode = final?.mode
  const finalScore = final?.score
  const finalRun = final?.run
  useEffect(() => {
    if (finalMode === undefined || finalScore === undefined || finalRun === undefined) return
    gen.current++ // drop the puzzle in flight
    // one POST per run (the run id is its start time): StrictMode re-runs and a late session status do not resend
    if (auth !== 'authenticated' || postedRun.current === finalRun) return
    postedRun.current = finalRun
    setSaved({ state: 'saving' })
    fetch('/api/chess/storm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: finalMode, score: finalScore, tzOffsetMin: new Date().getTimezoneOffset() }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b: { best: number; record: boolean; newBadges: string[]; profile: ChessProgressDto }) => {
        setMyChessProgress(b.profile) // the header flame and the start screen's records update at once
        setSaved({ state: 'done', best: b.best, record: b.record, newBadges: b.newBadges })
      })
      .catch(() => setSaved({ state: 'error' }))
  }, [finalMode, finalScore, finalRun, auth])

  // ─── moves ──────────────────────────────────────────────────────────────────
  const next = (ok: boolean) => {
    if (!puzzle) return
    setLog((l) => [...l, { id: puzzle.id, rating: puzzle.rating, ok }])
    const at = Date.now()
    const s = ok ? solve(storm!, at) : miss(storm!, at)
    setStorm(s)
    setNow(at)
    if (!ok) setPenaltyKey((k) => k + 1)
    if (s.over) return
    const index = s.score + s.errors
    if (ok) return show(index)
    const my = ++gen.current
    setPhase('wait')
    setTimeout(() => my === gen.current && show(index), NEXT_MS)
  }

  const onMove = (m: BoardMove) => {
    if (phase !== 'play' || !run || !storm || storm.over) return
    const uci = m.from + m.to + (m.promotion ?? '')
    const res = tryMove(run, uci)
    if (!res.ok) {
      setWrong({ from: m.from, to: m.to })
      return next(false)
    }
    playMoveSound(soundKind(run.fen, uci))
    setRun(res.run)
    if (res.done) return next(true)
    const my = gen.current
    setPhase('wait')
    setTimeout(() => {
      if (my !== gen.current) return
      playMoveSound(soundKind(res.run.fen, res.run.solution[res.run.ply]))
      setRun(replyMove(res.run))
      setPhase('play')
    }, REPLY_MS)
  }

  // ─── view ───────────────────────────────────────────────────────────────────
  const best = (m: StormMode) => (me.status === 'ready' ? (m === 3 ? me.profile.stormBest3 : me.profile.stormBest5) : 0)
  const left = storm ? timeLeftMs(storm, now) : mode * 60_000
  const side = puzzle ? playerColor(puzzle) : 'w'
  const fen = run?.fen ?? puzzle?.fen
  const highlights: Record<string, string> = wrong ? { [wrong.to]: 'rgba(200, 44, 44, 0.45)' } : {}

  const head = (
    <header className={styles.head}>
      <Link href="/chess" className={styles.back} aria-label={th('hub_title')}>
        <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
      <h1 className={styles.title}>{t('title')}</h1>
      <StreakFlame className={styles.flame} />
    </header>
  )

  // ─── start screen ───────────────────────────────────────────────────────────
  if (!storm) {
    return (
      <div className={styles.page}>
        {head}
        <div className={styles.intro}>
          <div className={styles.introBoard} aria-hidden="true">
            <ChessBoard fen={INTRO_FEN} interactive={false} />
            <Zap className={styles.introBolt} size={64} strokeWidth={1.5} />
          </div>
          <div className={styles.introText}>
            <p className={styles.lead}>{t('lead')}</p>
            <ul className={styles.rules}>
              <li>{t('rule_climb')}</li>
              <li>{t('rule_penalty')}</li>
              <li>{t('rule_errors')}</li>
            </ul>
            <div className={styles.modes}>
              {MODES.map((m) => (
                <button key={m} type="button" className={styles.modeCard} onClick={() => begin(m)}>
                  <span className={styles.modeMin}>{m}</span>
                  <span className={styles.modeUnit}>{t('minutes', { n: m })}</span>
                  <span className={styles.modeBest}>
                    {me.status === 'ready' ? (best(m) ? t('best', { n: best(m) }) : t('best_none')) : ' '}
                  </span>
                  <span className={styles.modeGo}>{t('start')}</span>
                </button>
              ))}
            </div>
            {me.status === 'guest' && (
              <p className={styles.guest}>
                <LogIn size={16} strokeWidth={2} aria-hidden="true" />
                <span>{t('guest_note')}</span>
                <Link href="/login">{t('login')}</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── run ────────────────────────────────────────────────────────────────────
  const errorsLeft = STORM_MAX_ERRORS - storm.errors
  return (
    <div className={styles.page}>
      {head}
      <div className={styles.layout}>
        <section className={styles.score} aria-label={t('scoreboard')}>
          <div className={styles.timer} data-low={running && left <= 15_000 ? '' : undefined}>
            <span className={styles.timerLabel}>{t('time')}</span>
            <span className={styles.timerValue} role="timer" aria-live="off">{clock(left)}</span>
            {penaltyKey > 0 && running && (
              <span key={penaltyKey} className={styles.penalty} aria-hidden="true">{t('penalty')}</span>
            )}
          </div>
          <div className={styles.solved}>
            <span className={styles.timerLabel}>{t('score')}</span>
            <span className={styles.solvedValue} aria-live="polite">{storm.score}</span>
          </div>
          <div className={styles.errors} aria-label={t('errors_aria', { n: storm.errors, max: STORM_MAX_ERRORS })}>
            <span className={styles.timerLabel}>{t('errors')}</span>
            <span className={styles.errorSlots}>
              {Array.from({ length: STORM_MAX_ERRORS }, (_, i) => (
                <span key={i} className={styles.slot} data-used={i < storm.errors || undefined}>
                  <X size={14} strokeWidth={2.75} aria-hidden="true" />
                </span>
              ))}
            </span>
          </div>
        </section>

        <div className={styles.boardCol}>
          {storm.over ? (
            <section className={styles.result} aria-live="polite">
              <p className={styles.resultReason}>{t(storm.reason === 'errors' ? 'over_errors' : 'over_time')}</p>
              <p className={styles.resultScore}>
                <span>{storm.score}</span>
                {t('solved_n', { n: storm.score })}
              </p>
              {auth !== 'authenticated' ? (
                <p className={styles.resultNote}>
                  {t('guest_result')} <Link href="/login">{t('login')}</Link>
                </p>
              ) : saved?.state === 'saving' ? (
                <p className={styles.resultNote}>{t('saving')}</p>
              ) : saved?.state === 'error' ? (
                <p className={styles.resultNote}>{t('save_error')}</p>
              ) : saved?.state === 'done' ? (
                <>
                  <p className={styles.record} data-new={saved.record || undefined}>
                    <Trophy size={18} strokeWidth={2} aria-hidden="true" />
                    {saved.record ? t('record_new') : t('best', { n: saved.best })}
                  </p>
                  {saved.newBadges.length > 0 && (
                    <ul className={styles.badges} aria-label={t('new_badges')}>
                      {saved.newBadges.map((code) => {
                        const b = badgeText(code)
                        return (
                          <li key={code}>
                            <BadgeMedal group={b.group} n={b.values.n} earned size={44} />
                            <span>{tp(b.nameKey, b.values)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              ) : null}
              <div className={styles.resultActions}>
                <button type="button" className={styles.primary} onClick={() => begin(mode)}>
                  <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                  {t('again')}
                </button>
                <button type="button" className={styles.secondary} onClick={() => setStorm(null)}>
                  {t('other_mode')}
                </button>
              </div>
            </section>
          ) : phase === 'error' ? (
            <section className={`${styles.result} ${styles.errorBox}`}>
              <SearchX size={28} strokeWidth={1.75} aria-hidden="true" />
              <p className={styles.resultNote}>{t('error')}</p>
              <button type="button" className={styles.primary} onClick={() => show(storm.score + storm.errors)}>
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                {t('retry')}
              </button>
            </section>
          ) : (
            <>
              <p className={styles.status} data-tone={wrong ? 'bad' : undefined} aria-live="polite">
                <span className={styles.turnDot} data-color={side} aria-hidden="true" />
                {phase === 'loading' ? t('loading') : wrong ? t('wrong', { n: errorsLeft }) : t(side === 'w' ? 'turn_w' : 'turn_b')}
                {puzzle && <span className={styles.statusRating}>{puzzle.rating}</span>}
              </p>
              {fen ? (
                <ChessBoard
                  fen={fen}
                  orientation={side}
                  onMove={onMove}
                  interactive={phase === 'play'}
                  lastMove={run?.lastMove ?? null}
                  check={checkSquare(fen)}
                  highlights={highlights}
                />
              ) : (
                <div className={styles.ghost} />
              )}
            </>
          )}
        </div>

        <aside className={styles.log} aria-label={t('log')}>
          <h2 className={styles.logTitle}>{t('log')}</h2>
          {log.length === 0 ? (
            <p className={styles.logEmpty}>{t('log_empty')}</p>
          ) : (
            <ol className={styles.logList}>
              {log.map((x, i) => (
                <li key={x.id + i} data-ok={x.ok || undefined}>
                  {x.ok ? <Check size={13} strokeWidth={2.75} aria-hidden="true" /> : <X size={13} strokeWidth={2.75} aria-hidden="true" />}
                  <span>{x.rating}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  )
}
