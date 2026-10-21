'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {type BoardMove} from '@/widgets/Chess/Board'
import {useMoveCoach, type MoveReview} from '@/widgets/Chess/Coach'
import {setMyChessProgress, useChessActivity, useMyChessProgress} from '@/widgets/Chess/Progress'
import {levelPiece, levelUp, pathAt, usePathProgress, type PathPiece} from '@/widgets/Chess/Path'
import {getEngine} from '@/shared/lib/chess/engine'
import {playMoveSound} from '@/shared/lib/chess/sound'
import {OPENINGS, TACTICS} from '@/shared/lib/chess/data'
import {
  hintMove,
  isCleanSolve,
  playerColor,
  replyMove,
  soundKind,
  startRun,
  takeHint,
  tryMove,
  type PuzzleRun,
  type Sq
} from './puzzleRun'

// The puzzle trainer behind /chess/puzzles: the path, free modes (rated / theme / series / opening), the coach on
// a wrong move, attempts and guest path progress. PuzzlesPage only lays it out.

export type PuzzleMode = 'path' | 'rated' | 'theme' | 'series' | 'opening'
export type Puzzle = {id: string; fen: string; moves: string[]; rating: number; themes: string[]; openingTags: string[]}
export type Profile = {puzzleRating: number; solved: number; failed: number}
export type Status = 'loading' | 'intro' | 'play' | 'reply' | 'done' | 'empty' | 'error'

export const SERIES_LEN = 5
const SERIES_STEP = 150 // rating added per puzzle in a series
const REPLY_MS = 500
export const MODES: PuzzleMode[] = ['path', 'rated', 'theme', 'series', 'opening']
export const TACTIC_IDS = new Set(TACTICS.map((x) => x.id))

export type PuzzleTrainerInit = { mode?: PuzzleMode; theme?: string; opening?: string }

/** What the coach says after a path step (`chess.learn` key + its values). */
export type PathNote = {
  key: 'path_coach_levelup' | 'path_coach_clean' | 'path_coach_fail'
  n: number
  piece?: PathPiece
}

export function usePuzzleTrainer(props: PuzzleTrainerInit) {
  const coach = useMoveCoach()
  const reportActivity = useChessActivity()

  const myProgress = useMyChessProgress()
  const pathProgress = usePathProgress()
  const [mode, setMode] = useState<PuzzleMode>(
    props.mode ?? (props.theme ? 'theme' : props.opening ? 'opening' : 'path')
  )
  // the screen opens on the path; a direct link to a mode (/chess/puzzles?mode=…) opens the board
  const [view, setView] = useState<'path' | 'solve'>(mode === 'path' ? 'path' : 'solve')
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
  const [series, setSeries] = useState<{start: number | null; results: boolean[]}>({start: null, results: []})

  // path: what the coach says after a step, and where the walk starts when the map comes back
  const [pathNote, setPathNote] = useState<PathNote | null>(null)
  const [pathFrom, setPathFrom] = useState<number | undefined>(undefined)

  const [review, setReview] = useState<MoveReview | null>(null)
  const [noAnalysis, setNoAnalysis] = useState(false)
  const [analysing, setAnalysing] = useState(false)

  const gen = useRef(0) // bumps on every new puzzle: late engine answers / timers of the old one are dropped
  const seen = useRef<string[]>([])
  const sent = useRef(false) // an attempt for the current puzzle is already posted
  const engineUsed = useRef(false)

  const context = mode === 'theme' ? 'tactic' : 'puzzle'
  const solvedSteps = profile?.solved ?? pathProgress.solved

  const clearCoach = () => {
    if (engineUsed.current) getEngine().cancelAll()
    setReview(null)
    setNoAnalysis(false)
    setAnalysing(false)
  }

  const sendAttempt = (p: Puzzle, solved: boolean) => {
    if (sent.current || guest) return
    sent.current = true
    if (solved) reportActivity({kind: 'puzzle'})
    const before = profile?.puzzleRating
    fetch(`/api/chess/puzzles/${encodeURIComponent(p.id)}/attempt`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({solved})
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: {profile?: Profile} | null) => {
        if (!b?.profile) return
        setProfile(b.profile)
        if (myProgress.status === 'ready')
          setMyChessProgress({
            ...myProgress.profile,
            puzzleRating: b.profile.puzzleRating,
            puzzlesSolved: b.profile.solved
          })
        if (before != null && b.profile.puzzleRating !== before) setDelta(b.profile.puzzleRating - before)
      })
      .catch(() => {})
  }

  const load = useCallback(
    async (
      m: PuzzleMode,
      opts: {theme: string; opening: string; seriesStart: number | null; seriesIndex: number; minRating?: number}
    ) => {
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
      if (m === 'series' && opts.seriesStart != null)
        q.set('minRating', String(opts.seriesStart + opts.seriesIndex * SERIES_STEP))
      // path: the step sets the floor; the server still centres on the player's rating when it is higher
      if (m === 'path' && opts.minRating != null) q.set('minRating', String(opts.minRating))
      if (seen.current.length) q.set('exclude', seen.current.slice(-200).join(','))
      try {
        const res = await fetch(`/api/chess/puzzles/next?${q}`)
        if (my !== gen.current) return
        if (res.status === 404) return setStatus('empty')
        if (!res.ok) return setStatus('error')
        const body = (await res.json()) as {puzzle: Puzzle; profile: Profile | null}
        if (my !== gen.current) return
        seen.current.push(body.puzzle.id)
        setPuzzle(body.puzzle)
        setProfile(body.profile)
        setGuest(!body.profile)
        if (m === 'series' && opts.seriesStart == null) setSeries({start: body.puzzle.rating, results: []})
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
      const s = fresh ? {start: null, results: []} : series
      if (fresh) setSeries(s)
      void load(m, {theme: th, opening: op, seriesStart: s.start, seriesIndex: s.results.length})
    } else
      void load(m, {
        theme: th,
        opening: op,
        seriesStart: null,
        seriesIndex: 0,
        minRating: m === 'path' ? pathAt(solvedSteps ?? 0).current.minRating : undefined
      })
  }

  useEffect(() => {
    if (view === 'solve') next() // the path screen loads its first puzzle on «Solve»
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
    if (mode === 'path') {
      const step = (solvedSteps ?? 0) + 1
      if (clean && guest) pathProgress.addGuestStep()
      const up = clean ? levelUp(step - 1, step) : null
      setPathNote(
        up
          ? {key: 'path_coach_levelup', n: up, piece: levelPiece(up)}
          : {key: clean ? 'path_coach_clean' : 'path_coach_fail', n: step}
      )
    }
    if (mode === 'series') setSeries((s) => ({...s, results: [...s.results, clean]}))
  }

  const onMove = (m: BoardMove) => {
    if (status !== 'play' || !run || !puzzle) return
    const uci = m.from + m.to + (m.promotion ?? '')
    const res = tryMove(run, uci)
    if (!res.ok) {
      // the board keeps its fen → the piece slides back; the coach looks at what went wrong
      setWrong({from: m.from, to: m.to})
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
    setPathNote(null)
    next(m)
  }

  /** «Solve»: from the map to the board, on the current step */
  const startPath = () => {
    setPathFrom(solvedSteps ?? 0)
    setPathNote(null)
    setView('solve')
    setMode('path')
    next('path')
  }
  /** back to the map: the traveller walks from where the player last saw it */
  const toPath = () => {
    gen.current++
    if (engineUsed.current) getEngine().cancelAll()
    setMode('path')
    setView('path')
  }
  const freePlay = () => {
    setView('solve')
    setPathNote(null)
    setMode('rated')
    next('rated')
  }

  const takeHintStep = () => {
    setHint((h) => h + 1)
    setRun((r) => r && takeHint(r))
  }
  const pickTheme = (id: string) => {
    setTheme(id)
    next('theme', id)
  }
  const pickOpening = (tag: string) => {
    setOpening(tag)
    next('opening', theme, tag)
  }

  // the solver's side is fixed for the whole puzzle: the side to move after the opponent's first move
  const me = puzzle ? playerColor(puzzle) : 'w'
  const fen = run?.fen ?? puzzle?.fen
  const hinted = run && status === 'play' && hint > 0 ? hintMove(run) : null
  const highlights: Record<string, string> = {}
  if (wrong) highlights[wrong.to] = 'rgba(200, 44, 44, 0.42)'
  if (hinted) highlights[hinted.from] = 'rgba(23, 133, 90, 0.5)'

  return {
    mode,
    view,
    theme,
    opening,
    puzzle,
    run,
    status,
    hint,
    wrong,
    profile,
    guest,
    delta,
    series,
    seriesDone: mode === 'series' && series.results.length >= SERIES_LEN,
    usedHelp: !!run && !isCleanSolve(run),
    me,
    fen,
    hinted,
    highlights,
    review,
    noAnalysis,
    analysing,
    explain: coach.explain,
    pathNote,
    pathFrom,
    solvedSteps,
    pathGuest: pathProgress.guest,
    myProgress,
    next,
    onMove,
    pickMode,
    pickTheme,
    pickOpening,
    takeHintStep,
    startPath,
    toPath,
    freePlay
  }
}
