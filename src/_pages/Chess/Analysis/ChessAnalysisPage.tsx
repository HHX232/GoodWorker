'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Chess } from 'chess.js'
import {
  ArrowUpDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Lock,
  MessageCircleQuestion,
  RotateCw,
  Square,
  SquarePen,
} from 'lucide-react'
import { ChessBoard, type BoardArrow } from '@/widgets/Chess/Board'
import { CoachSays, EvalBar, useMoveCoach, type ExplainResult, type MoveReview } from '@/widgets/Chess/Coach'
import { AccuracyCard, ClassIcon, CLASS_COLOR, EvalGraph, ReviewMoves } from '@/widgets/Chess/Review'
import { getEngine, type EngineLine } from '@/shared/lib/chess/engine'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { ANALYSIS_KEY, coachClass, loadGame, reviewGame, type AnalysisHandoff, type GameReview, type LoadedGame, type ReviewedMove } from '@/shared/lib/chess/reviewModel'
import styles from './ChessAnalysisPage.module.scss'


// spec: MultiPV 2, ~0.6 s per position
const ANALYSIS = { multiPV: 2, depth: 18, movetimeMs: 1200 } // depth 18 or 1.2 s per position, whichever first

type Phase =
  | { k: 'idle'; note?: 'cancelled' | 'bad_pgn' }
  | { k: 'loading' }
  | { k: 'analysing'; done: number; total: number }
  | { k: 'done' }
  | { k: 'error'; msg: 'game_not_found' | 'game_login' | 'game_error' | 'game_empty' | 'engine_down' | 'no_analysis' }

const uciMove = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })

function readHandoff(): LoadedGame | null {
  try {
    const raw = sessionStorage.getItem(ANALYSIS_KEY)
    if (!raw) return null
    const h = JSON.parse(raw) as AnalysisHandoff
    const g = typeof h.pgn === 'string' ? loadGame({ pgn: h.pgn }) : Array.isArray(h.moves) ? loadGame({ moves: h.moves, initialFen: h.initialFen }) : null
    if (!g) return null
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
    return { ...g, white: str(h.white) ?? g.white, black: str(h.black) ?? g.black, result: str(h.result) ?? g.result }
  } catch {
    return null
  }
}

export function ChessAnalysisPage({ gameId }: { gameId?: string }) {
  const t = useTranslations('chess.analysis')
  const tc = useTranslations('chess.core')
  const coach = useMoveCoach()
  const [game, setGame] = useState<LoadedGame | null>(null)
  const [phase, setPhase] = useState<Phase>({ k: 'idle' })
  const [review, setReview] = useState<GameReview | null>(null)
  const [cur, setCur] = useState(-1) // ply shown; −1 = the starting position
  const [keyOnly, setKeyOnly] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [pgn, setPgn] = useState('')
  const [pasting, setPasting] = useState(false)
  const gen = useRef(0) // bumps on every new review / cancel / unmount: stale engine answers are dropped

  // ─── run the engine over every position, then classify ───────────────────────
  const run = useCallback(async (g: LoadedGame) => {
    const my = ++gen.current
    const engine = getEngine()
    engine.cancelAll()
    setGame(g)
    setReview(null)
    setCur(-1)
    setPasting(false)
    if (!g.moves.length) return setPhase({ k: 'error', msg: 'game_empty' })
    const chess = new Chess(g.initialFen)
    const fens = [chess.fen(), ...g.moves.map((m) => (chess.move(uciMove(m)), chess.fen()))]
    setPhase({ k: 'analysing', done: 0, total: fens.length })
    const analyses: EngineLine[][] = []
    try {
      for (const fen of fens) {
        analyses.push(new Chess(fen).isGameOver() ? [] : await engine.analyse(fen, ANALYSIS))
        if (my !== gen.current) return
        setPhase({ k: 'analysing', done: analyses.length, total: fens.length })
      }
      setReview(reviewGame({ initialFen: g.initialFen, moves: g.moves, analyses }))
      setPhase({ k: 'done' })
    } catch (e) {
      if (my !== gen.current) return
      const m = (e as Error).message
      if (m === 'ENGINE_CANCELLED') setPhase({ k: 'idle', note: 'cancelled' })
      else setPhase({ k: 'error', msg: m === 'ENGINE_UNAVAILABLE' ? 'engine_down' : 'no_analysis' })
    }
  }, [])

  const cancel = () => {
    gen.current++
    getEngine().cancelAll()
    setPhase({ k: 'idle', note: 'cancelled' })
  }

  // leaving the page stops the engine
  useEffect(
    () => () => {
      gen.current++
      getEngine().cancelAll()
    },
    []
  )

  // ─── input: ?game=<id> → the online game; else the handoff from a game page ───
  useEffect(() => {
    if (!gameId) {
      const g = readHandoff()
      if (g) void run(g)
      else setPasting(true)
      return
    }
    let live = true
    setPhase({ k: 'loading' })
    fetch(`/api/chess/games/${encodeURIComponent(gameId)}`)
      .then(async (res) => {
        if (!live) return
        if (res.status === 404) return setPhase({ k: 'error', msg: 'game_not_found' })
        if (res.status === 401) return setPhase({ k: 'error', msg: 'game_login' })
        const s = res.ok ? await res.json().catch(() => null) : null
        const g = s && Array.isArray(s.moves) ? loadGame({ moves: s.moves, initialFen: s.initialFen }) : null
        if (!live) return
        if (!s || (!g && s.moves?.length)) return setPhase({ k: 'error', msg: 'game_error' })
        void run({ ...(g ?? { initialFen: s.initialFen, moves: [] }), white: s.white?.name, black: s.black?.name, result: s.result ?? undefined })
      })
      .catch(() => live && setPhase({ k: 'error', msg: 'game_error' }))
    return () => {
      live = false
    }
  }, [gameId, run])

  const submitPgn = (e: FormEvent) => {
    e.preventDefault()
    const g = loadGame({ pgn })
    if (!g) return setPhase({ k: 'idle', note: 'bad_pgn' })
    try {
      sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify({ pgn, source: 'pgn' } satisfies AnalysisHandoff))
    } catch {}
    void run(g)
  }

  // ─── stepping: arrows / Home / End; "key moments only" steps through those ────
  const moves = review?.moves ?? []
  const stops = keyOnly && review ? review.keyMoments : moves.map((m) => m.ply)
  const step = useCallback(
    (dir: -1 | 1) => {
      setCur((c) => {
        if (dir > 0) return stops.find((p) => p > c) ?? c
        return [...stops].reverse().find((p) => p < c) ?? -1
      })
    },
    [stops]
  )
  useEffect(() => {
    if (!review) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('textarea, input:not([type="checkbox"]), [role="group"]')) return // the board's own arrow keys move its focus
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'Home') setCur(-1)
      else if (e.key === 'End') setCur(moves.length - 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [review, step, moves.length])

  // ─── view ─────────────────────────────────────────────────────────────────────
  const m: ReviewedMove | undefined = moves[cur]
  const fen = m?.fenAfter ?? game?.initialFen ?? new Chess().fen()
  const orientation: 'w' | 'b' = flipped ? 'b' : 'w'
  const showBest = m && m.cls !== 'book' && m.uci !== m.bestUci && m.bestUci
  const arrows: BoardArrow[] = showBest ? [{ from: m.bestUci.slice(0, 2), to: m.bestUci.slice(2, 4), color: CLASS_COLOR.best, opacity: 0.8 }] : []
  const evalCp = m ? m.evalAfterCp : (moves[0]?.evalBeforeCp ?? 0)
  const names = { w: game?.white ?? t('white'), b: game?.black ?? t('black') }

  const strip = (side: 'w' | 'b') => (
    <div className={styles.strip}>
      <span className={styles.stripDot} data-side={side} aria-hidden="true" />
      <span className={styles.stripName}>{names[side]}</span>
      {review && <span className={styles.stripAcc}>{(Math.round(review.accuracy[side] * 10) / 10).toFixed(1)}</span>}
    </div>
  )

  const analysing = phase.k === 'analysing' || phase.k === 'loading'
  const coachLine = () => {
    if (analysing) return <p className={styles.coachText}>{t('coach_analysing')}</p>
    if (!review) return <p className={styles.coachText}>{t('coach_idle')}</p>
    if (!m) return <p className={styles.coachText}>{t('coach_start')}</p>
    return <MoveCoach key={m.ply} move={m} explain={coach.explain} />
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('title')}</h1>
        <div className={styles.headTools}>
          {!pasting && (
            <button type="button" className={styles.tool} onClick={() => setPasting(true)}>
              <SquarePen size={16} strokeWidth={2} aria-hidden="true" />
              {t('new_review')}
            </button>
          )}
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.coachCol} aria-label={tc('coach_title')}>
          <CoachSays mood={analysing ? 'thinking' : m && ['mistake', 'miss', 'blunder'].includes(m.cls) ? 'concerned' : 'idle'}>
            {coachLine()}
          </CoachSays>
          {review && (
            <div className={styles.card}>
              <AccuracyCard review={review} white={names.w} black={names.b} />
            </div>
          )}
        </aside>

        <section className={styles.boardCol} aria-label={tc('board_label')}>
          {strip(orientation === 'w' ? 'b' : 'w')}
          <div className={styles.stage}>
            <EvalBar cp={review ? evalCp : 0} orientation={orientation} className={styles.evalBar} />
            <ChessBoard
              fen={fen}
              orientation={orientation}
              interactive={false}
              lastMove={m ? { from: m.uci.slice(0, 2), to: m.uci.slice(2, 4) } : null}
              check={checkSquare(fen)}
              arrows={arrows}
              squareBadges={m ? { [m.uci.slice(2, 4)]: <ClassIcon cls={m.cls} label={t(`class_${m.cls}`)} /> } : undefined}
            />
          </div>
          {strip(orientation)}

          <div className={styles.nav}>
            <button type="button" className={styles.navBtn} onClick={() => setCur(-1)} disabled={!review || cur < 0} aria-label={t('first')}>
              <ChevronFirst size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className={styles.navBtn} onClick={() => step(-1)} disabled={!review || cur < 0} aria-label={t('prev')}>
              <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navMain}`}
              onClick={() => step(1)}
              disabled={!review || !stops.some((p) => p > cur)}
              aria-label={t('next')}
            >
              <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className={styles.navBtn} onClick={() => setCur(moves.length - 1)} disabled={!review || cur === moves.length - 1} aria-label={t('last')}>
              <ChevronLast size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className={styles.navBtn} onClick={() => setFlipped((f) => !f)} aria-label={t('flip')} title={t('flip')}>
              <ArrowUpDown size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside className={styles.rail}>
          {phase.k === 'analysing' && (
            <div className={styles.card} role="status">
              <p className={styles.progressText}>{t('progress', { done: phase.done, total: phase.total })}</p>
              <div className={styles.bar}>
                <span style={{ transform: `scaleX(${phase.done / phase.total})` }} />
              </div>
              <button type="button" className={styles.tool} onClick={cancel}>
                <Square size={14} strokeWidth={2.25} aria-hidden="true" />
                {t('cancel')}
              </button>
            </div>
          )}
          {phase.k === 'loading' && (
            <p className={styles.muted} role="status">
              {t('loading_game')}
            </p>
          )}
          {phase.k === 'error' && (
            <div className={styles.alert} role="alert">
              <CloudOff size={16} strokeWidth={2} aria-hidden="true" />
              <span>{t(phase.msg)}</span>
              {game && phase.msg === 'no_analysis' && (
                <button type="button" className={styles.link} onClick={() => void run(game)}>
                  <RotateCw size={13} strokeWidth={2.25} aria-hidden="true" />
                  {t('retry')}
                </button>
              )}
            </div>
          )}

          {(pasting || (phase.k === 'idle' && !review)) && !analysing && (
            <form className={styles.card} onSubmit={submitPgn}>
              <label className={styles.cardTitle} htmlFor="pgn">
                {t('paste_title')}
              </label>
              <textarea
                id="pgn"
                className={styles.pgn}
                value={pgn}
                onChange={(e) => setPgn(e.target.value)}
                placeholder={t('paste_placeholder')}
                rows={6}
                spellCheck={false}
                aria-describedby="pgn-hint"
                aria-invalid={phase.k === 'idle' && phase.note === 'bad_pgn'}
              />
              <p id="pgn-hint" className={phase.k === 'idle' && phase.note === 'bad_pgn' ? styles.error : styles.muted}>
                {phase.k === 'idle' && phase.note === 'bad_pgn' ? t('bad_pgn') : phase.k === 'idle' && phase.note === 'cancelled' ? t('cancelled') : t('paste_hint')}
              </p>
              <button type="submit" className={`${styles.tool} ${styles.toolStrong}`} disabled={!pgn.trim()}>
                {t('analyse')}
              </button>
            </form>
          )}

          {review && (
            <>
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>{t('graph')}</h2>
                <EvalGraph moves={moves} current={cur} onPick={setCur} />
              </div>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>{t('moves')}</h2>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={keyOnly} onChange={(e) => setKeyOnly(e.target.checked)} />
                    {t('key_only')}
                  </label>
                </div>
                <ReviewMoves moves={moves} current={cur} onPick={setCur} keyOnly={keyOnly} keyMoments={review.keyMoments} />
              </div>
            </>
          )}

          <p className={styles.credit}>{tc('engine_credit')}</p>
        </aside>
      </div>
    </div>
  )
}

// ─── the coach on the selected move: a line from the review, "Why?" asks /api/chess/coach ────

function MoveCoach({ move, explain }: { move: ReviewedMove; explain: (r: MoveReview) => Promise<ExplainResult> }) {
  const t = useTranslations('chess.analysis')
  const tc = useTranslations('chess.core')
  const [result, setResult] = useState<ExplainResult | null>(null)
  const [loading, setLoading] = useState(false)

  const ask = async () => {
    setResult(null)
    setLoading(true)
    // real review data; the API knows five classes (coachClass maps the other five onto them).
    // A book move is explained as opening theory: for 'opening' the server ignores class and evals.
    setResult(
      await explain({
        classification: coachClass(move.cls),
        bestUci: move.bestUci,
        bestSan: move.bestSan,
        playedSan: move.san,
        pvUci: move.pvUci,
        evalBeforeCp: move.evalBeforeCp,
        evalAfterCp: move.evalAfterCp,
        fenBefore: move.fenBefore,
        playedUci: move.uci,
        context: move.cls === 'book' ? 'opening' : 'game',
      })
    )
    setLoading(false)
  }

  return (
    <div className={styles.coachBody} aria-live="polite">
      <p className={styles.coachCls} style={{ color: CLASS_COLOR[move.cls] }}>
        <ClassIcon cls={move.cls} size={18} />
        {t(`class_${move.cls}`)}
      </p>
      <p className={styles.coachText}>{t(`say_${move.cls}`, { played: move.san, best: move.bestSan })}</p>
      {!result && !loading && (
        <button type="button" className={styles.link} onClick={ask}>
          <MessageCircleQuestion size={15} strokeWidth={2} aria-hidden="true" />
          {tc('coach_why')}
        </button>
      )}
      {loading && (
        <p className={styles.muted} role="status">
          {tc('coach_explaining')}
        </p>
      )}
      {result?.ok && <p className={styles.explanation}>{result.text}</p>}
      {result && !result.ok && (
        <p className={styles.notice}>
          {result.reason === 'LIMIT' ? <Lock size={15} strokeWidth={2} aria-hidden="true" /> : <CloudOff size={15} strokeWidth={2} aria-hidden="true" />}
          <span>
            {result.reason === 'LIMIT'
              ? `${tc('coach_limit')} ${tc(result.tier === 'guest' ? 'coach_limit_guest' : 'coach_limit_user')}`
              : tc(result.reason === 'BAD_INPUT' ? 'coach_bad_input' : 'coach_unavailable')}
          </span>
          {result.reason === 'UNAVAILABLE' && (
            <button type="button" className={styles.link} onClick={ask}>
              <RotateCw size={13} strokeWidth={2.25} aria-hidden="true" />
              {tc('coach_retry')}
            </button>
          )}
        </p>
      )}
    </div>
  )
}
