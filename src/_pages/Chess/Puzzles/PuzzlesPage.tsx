'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, Check, Lightbulb, LogIn, RotateCcw, SearchX, X } from 'lucide-react'
import { ChessBoard, type BoardMove } from '@/widgets/Chess/Board'
import { CoachPanel, CoachSays, useMoveCoach, type MoveReview } from '@/widgets/Chess/Coach'
import { getEngine } from '@/shared/lib/chess/engine'
import { playMoveSound } from '@/shared/lib/chess/sound'
import { OPENINGS, TACTICS } from '@/shared/lib/chess/data'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { hintMove, isCleanSolve, playerColor, replyMove, soundKind, startRun, takeHint, tryMove, type PuzzleRun, type Sq } from './puzzleRun'
import { useChessActivity } from '@/widgets/Chess/Progress'
import styles from './Puzzles.module.scss'

export type PuzzleMode = 'rated' | 'theme' | 'series' | 'opening'
type Puzzle = { id: string; fen: string; moves: string[]; rating: number; themes: string[]; openingTags: string[] }
type Profile = { puzzleRating: number; solved: number; failed: number }
type Status = 'loading' | 'intro' | 'play' | 'reply' | 'done' | 'empty' | 'error'

const SERIES_LEN = 5
const SERIES_STEP = 150 // rating added per puzzle in a series
const REPLY_MS = 500
const MODES: PuzzleMode[] = ['rated', 'theme', 'series', 'opening']
const TACTIC_IDS = new Set(TACTICS.map((x) => x.id))

export type PuzzlesPageProps = { mode?: PuzzleMode; theme?: string; opening?: string }

export function PuzzlesPage(props: PuzzlesPageProps) {
  const t = useTranslations('chess.learn')
  const tp = useTranslations('chess.play')
  const tc = useTranslations('chess.core')
  const coach = useMoveCoach()
  const reportActivity = useChessActivity()

  const [mode, setMode] = useState<PuzzleMode>(props.mode ?? (props.theme ? 'theme' : props.opening ? 'opening' : 'rated'))
  const [theme, setTheme] = useState(props.theme && TACTIC_IDS.has(props.theme) ? props.theme : TACTICS[0].id)
  const [opening, setOpening] = useState(
    OPENINGS.find((o) => o.lichessTag === props.opening)?.lichessTag ?? OPENINGS[0].lichessTag
  )

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [run, setRun] = useState<PuzzleRun | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [hint, setHint] = useState(0) // hint step on the current move (1 = piece, 2 = arrow); scoring uses run.hints
  const [wrong, setWrong] = useState<Sq | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [guest, setGuest] = useState(false)
  const [delta, setDelta] = useState<number | null>(null)
  const [series, setSeries] = useState<{ start: number | null; results: boolean[] }>({ start: null, results: [] })

  const [review, setReview] = useState<MoveReview | null>(null)
  const [noAnalysis, setNoAnalysis] = useState(false)
  const [analysing, setAnalysing] = useState(false)

  const gen = useRef(0) // bumps on every new puzzle: late engine answers / timers of the old one are dropped
  const seen = useRef<string[]>([])
  const sent = useRef(false) // an attempt for the current puzzle is already posted
  const engineUsed = useRef(false)

  const context = mode === 'theme' ? 'tactic' : 'puzzle'

  const clearCoach = () => {
    if (engineUsed.current) getEngine().cancelAll()
    setReview(null)
    setNoAnalysis(false)
    setAnalysing(false)
  }

  const sendAttempt = (p: Puzzle, solved: boolean) => {
    if (sent.current || guest) return
    sent.current = true
    if (solved) reportActivity({ kind: 'puzzle' })
    const before = profile?.puzzleRating
    fetch(`/api/chess/puzzles/${encodeURIComponent(p.id)}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solved }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { profile?: Profile } | null) => {
        if (!b?.profile) return
        setProfile(b.profile)
        if (before != null && b.profile.puzzleRating !== before) setDelta(b.profile.puzzleRating - before)
      })
      .catch(() => {})
  }

  const load = useCallback(
    async (m: PuzzleMode, opts: { theme: string; opening: string; seriesStart: number | null; seriesIndex: number }) => {
      const my = ++gen.current
      if (engineUsed.current) getEngine().cancelAll()
      setReview(null)
      setNoAnalysis(false)
      setAnalysing(false)
      setStatus('loading')
      setRun(null)
      setHint(0)
      setWrong(null)
      setDelta(null)
      sent.current = false

      const q = new URLSearchParams()
      if (m === 'theme') q.set('theme', opts.theme)
      if (m === 'opening') q.set('opening', opts.opening)
      if (m === 'series' && opts.seriesStart != null) q.set('minRating', String(opts.seriesStart + opts.seriesIndex * SERIES_STEP))
      if (seen.current.length) q.set('exclude', seen.current.slice(-200).join(','))
      try {
        const res = await fetch(`/api/chess/puzzles/next?${q}`)
        if (my !== gen.current) return
        if (res.status === 404) return setStatus('empty')
        if (!res.ok) return setStatus('error')
        const body = (await res.json()) as { puzzle: Puzzle; profile: Profile | null }
        if (my !== gen.current) return
        seen.current.push(body.puzzle.id)
        setPuzzle(body.puzzle)
        setProfile(body.profile)
        setGuest(!body.profile)
        if (m === 'series' && opts.seriesStart == null) setSeries({ start: body.puzzle.rating, results: [] })
        setStatus('intro')
        // the opponent's first move plays itself after a beat
        setTimeout(() => {
          if (my !== gen.current) return
          const r = startRun(body.puzzle)
          setRun(r)
          setStatus('play')
          playMoveSound(soundKind(body.puzzle.fen, body.puzzle.moves[0]))
        }, REPLY_MS)
      } catch {
        if (my === gen.current) setStatus('error')
      }
    },
    []
  )

  const next = (m = mode, th = theme, op = opening) => {
    if (m === 'series') {
      const fresh = m !== mode || series.results.length >= SERIES_LEN
      const s = fresh ? { start: null, results: [] } : series
      if (fresh) setSeries(s)
      void load(m, { theme: th, opening: op, seriesStart: s.start, seriesIndex: s.results.length })
    } else void load(m, { theme: th, opening: op, seriesStart: null, seriesIndex: 0 })
  }

  useEffect(() => {
    next()
    const g = gen
    const used = engineUsed
    return () => {
      g.current++ // drop late fetches/timers/reviews after unmount
      if (used.current) getEngine().cancelAll()
    }
    // first puzzle once on mount; later loads come from user actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = (p: Puzzle, clean: boolean) => {
    setStatus('done')
    sendAttempt(p, clean)
    if (mode === 'series') setSeries((s) => ({ ...s, results: [...s.results, clean] }))
  }

  const onMove = (m: BoardMove) => {
    if (status !== 'play' || !run || !puzzle) return
    const uci = m.from + m.to + (m.promotion ?? '')
    const res = tryMove(run, uci)
    if (!res.ok) {
      // the board keeps its fen → the piece slides back; the coach looks at what went wrong
      setWrong({ from: m.from, to: m.to })
      setRun(res.run) // same fen, one more mistake
      sendAttempt(puzzle, false)
      if (engineUsed.current) getEngine().cancelAll()
      const my = ++gen.current // status is 'play': no timers of this puzzle are pending, only an older review
      engineUsed.current = true
      setReview(null)
      setNoAnalysis(false)
      setAnalysing(true)
      coach
        .review(run.fen, uci, context)
        .then((r) => my === gen.current && setReview(r))
        .catch((e: Error) => {
          if (my !== gen.current || e.message === 'ENGINE_CANCELLED') return
          setReview(null)
          setNoAnalysis(true)
        })
        .finally(() => my === gen.current && setAnalysing(false))
      return
    }
    playMoveSound(soundKind(run.fen, uci))
    setWrong(null)
    setHint(0)
    setRun(res.run)
    clearCoach()
    if (res.done) return finish(puzzle, isCleanSolve(res.run))
    setStatus('reply')
    const my = gen.current
    setTimeout(() => {
      if (my !== gen.current) return
      playMoveSound(soundKind(res.run.fen, res.run.solution[res.run.ply]))
      setRun(replyMove(res.run))
      setStatus('play')
    }, REPLY_MS)
  }

  const pickMode = (m: PuzzleMode) => {
    if (m === mode) return
    setMode(m)
    next(m)
  }

  // the solver's side is fixed for the whole puzzle: the side to move after the opponent's first move
  const me = puzzle ? playerColor(puzzle) : 'w'
  const fen = run?.fen ?? puzzle?.fen
  const hinted = run && status === 'play' && hint > 0 ? hintMove(run) : null
  const highlights: Record<string, string> = {}
  if (wrong) highlights[wrong.to] = 'rgba(200, 44, 44, 0.42)'
  if (hinted) highlights[hinted.from] = 'rgba(23, 133, 90, 0.5)'
  const seriesDone = mode === 'series' && series.results.length >= SERIES_LEN
  const usedHelp = !!run && !isCleanSolve(run)

  const statusLine =
    status === 'loading' || status === 'intro'
      ? t('pz_status_loading')
      : status === 'reply'
      ? t('pz_status_correct')
      : status === 'done'
      ? usedHelp
        ? t('pz_status_done_help')
        : t('pz_status_solved')
      : wrong
      ? t('pz_status_wrong')
      : t(me === 'w' ? 'pz_status_turn_w' : 'pz_status_turn_b')

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/chess" className={styles.back} aria-label={tp('hub_title')}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
          <h1 className={styles.title}>{t('pz_title')}</h1>
          {profile ? (
            <div className={styles.rating} aria-live="polite">
              <span className={styles.ratingLabel}>{t('pz_rating')}</span>
              <span className={styles.ratingValue}>
                {profile.puzzleRating}
                {delta != null && (
                  <span key={`${puzzle?.id}${delta}`} className={styles.delta} data-sign={delta > 0 ? 'up' : 'down'}>
                    {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                  </span>
                )}
              </span>
              <span className={styles.ratingMeta}>{t('pz_counts', { solved: profile.solved, failed: profile.failed })}</span>
            </div>
          ) : guest ? (
            <Link href="/login" className={styles.guest}>
              <LogIn size={16} aria-hidden="true" />
              <span>{t('pz_guest')}</span>
            </Link>
          ) : null}
        </header>

        {/* same frame as /chess/play: coach | board | controls, the board centred and fully on screen */}
        <div className={styles.layout}>
          <aside className={styles.coachCol} aria-label={tc('coach_title')}>
            {wrong || review || analysing || noAnalysis ? (
              <CoachPanel review={review} noAnalysis={noAnalysis} analysing={analysing} explain={coach.explain} />
            ) : (
              <CoachSays>{t(status === 'done' ? 'pz_coach_hint' : 'pz_lede')}</CoachSays>
            )}
          </aside>

          <div className={styles.boardCol}>
            {status === 'empty' || status === 'error' ? (
              <div className={styles.emptyBox}>
                <SearchX size={28} strokeWidth={1.75} aria-hidden="true" />
                <h2>{t(status === 'empty' ? 'pz_empty_title' : 'pz_error_title')}</h2>
                <p>{t(status === 'empty' ? 'pz_empty_text' : 'pz_error_text')}</p>
                {status === 'empty' && mode !== 'rated' ? (
                  <button type="button" className={styles.primary} onClick={() => pickMode('rated')}>
                    {t('pz_empty_reset')}
                  </button>
                ) : (
                  <button type="button" className={styles.primary} onClick={() => next()}>
                    <RotateCcw size={16} aria-hidden="true" /> {t('pz_retry')}
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className={styles.status} data-tone={status === 'done' ? (usedHelp ? 'warn' : 'ok') : wrong ? 'bad' : 'idle'} aria-live="polite">
                  <span className={styles.turnDot} data-color={me} aria-hidden="true" />
                  <span className={styles.statusText}>{statusLine}</span>
                </p>
                <div className={styles.boardWrap} data-loading={status === 'loading' || undefined}>
                  {fen ? (
                    <ChessBoard
                      fen={fen}
                      orientation={me}
                      onMove={onMove}
                      interactive={status === 'play'}
                      lastMove={run?.lastMove ?? null}
                      check={checkSquare(fen)}
                      highlights={highlights}
                      arrows={hinted && hint > 1 ? [{ from: hinted.from, to: hinted.to }] : []}
                    />
                  ) : (
                    <div className={styles.boardGhost} />
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.controlsArea}>
            {status !== 'empty' && status !== 'error' && (
              <div className={styles.controls}>
                {status !== 'done' ? (
                  <>
                    <button type="button" className={styles.secondary} disabled={status !== 'play' || hint >= 2} onClick={() => {
                        setHint((h) => h + 1)
                        setRun((r) => r && takeHint(r))
                      }}>
                      <Lightbulb size={16} aria-hidden="true" />
                      {t(hint === 0 ? 'pz_hint' : 'pz_hint_more')}
                    </button>
                    <button type="button" className={styles.ghost} disabled={status === 'loading'} onClick={() => next()}>
                      {t('pz_skip')}
                    </button>
                  </>
                ) : seriesDone ? null : (
                  <button type="button" className={styles.primary} onClick={() => next()}>
                    {t(mode === 'series' ? 'pz_next_series' : 'pz_next', { n: series.results.length + 1, total: SERIES_LEN })}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {seriesDone && (
              <section className={styles.card} aria-live="polite">
                <h2 className={styles.cardTitle}>{t('pz_series_done')}</h2>
                <p className={styles.bigScore}>
                  {t('pz_series_score', { n: series.results.filter(Boolean).length, total: SERIES_LEN })}
                </p>
                <button type="button" className={styles.primary} onClick={() => next('series')}>
                  {t('pz_series_again')}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </section>
            )}

            {puzzle && status !== 'empty' && status !== 'error' && (
              <section className={styles.card}>
                <div className={styles.meta}>
                  <span className={styles.metaLabel}>{t('pz_puzzle_rating')}</span>
                  <span className={styles.metaValue}>{puzzle.rating}</span>
                </div>
                {status === 'done' && (
                  <>
                    <div className={styles.result} data-tone={usedHelp ? 'warn' : 'ok'}>
                      {usedHelp ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                      {t(usedHelp ? 'pz_result_not_counted' : 'pz_result_solved')}
                    </div>
                    <div className={styles.tags}>
                      {puzzle.themes.filter((x) => TACTIC_IDS.has(x)).map((x) => (
                        <span key={x} className={styles.tag}>{t(`tc_${x}_name`)}</span>
                      ))}
                    </div>
                  </>
                )}
                {!profile && guest && status === 'done' && <p className={styles.note}>{t('pz_guest_note')}</p>}
              </section>
            )}
          </div>

          <aside className={styles.side}>
            <nav className={styles.modes} aria-label={t('pz_modes')}>
              {MODES.map((m) => (
                <button key={m} type="button" className={styles.mode} aria-pressed={mode === m} onClick={() => pickMode(m)}>
                  <span className={styles.modeName}>{t(`pz_mode_${m}`)}</span>
                  <span className={styles.modeDesc}>{t(`pz_mode_${m}_desc`)}</span>
                </button>
              ))}
            </nav>
            {mode === 'theme' && (
              <div className={styles.chips} role="group" aria-label={t('pz_pick_theme')}>
                {TACTICS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={theme === x.id}
                    onClick={() => {
                      setTheme(x.id)
                      next('theme', x.id)
                    }}
                  >
                    {t(x.nameKey)}
                  </button>
                ))}
              </div>
            )}
    
            {mode === 'opening' && (
              <label className={styles.selectRow}>
                <span>{t('pz_pick_opening')}</span>
                <select
                  className={styles.select}
                  value={opening}
                  onChange={(e) => {
                    setOpening(e.target.value)
                    next('opening', theme, e.target.value)
                  }}
                >
                  {OPENINGS.map((o) => (
                    <option key={o.id} value={o.lichessTag}>
                      {o.eco} · {t(o.nameKey)}
                    </option>
                  ))}
                </select>
              </label>
            )}
    
            {mode === 'series' && (
              <ol className={styles.series} aria-label={t('pz_series_progress', { n: series.results.length, total: SERIES_LEN })}>
                {Array.from({ length: SERIES_LEN }, (_, i) => {
                  const r = series.results[i]
                  const current = i === series.results.length && !seriesDone
                  return (
                    <li key={i} className={styles.seriesStep} data-state={r === true ? 'win' : r === false ? 'loss' : current ? 'now' : 'todo'}>
                      {r === true ? <Check size={14} aria-hidden="true" /> : r === false ? <X size={14} aria-hidden="true" /> : i + 1}
                    </li>
                  )
                })}
              </ol>
            )}

            <footer className={styles.footer}>
              {t('pz_credit')} ·{' '}
              <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noopener noreferrer">
                database.lichess.org
              </a>
            </footer>
          </aside>
        </div>
      </div>
    </div>
  )
}
