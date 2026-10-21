'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Chess, validateFen, DEFAULT_POSITION } from 'chess.js'
import type { BoardMove } from '@/widgets/Chess/Board'
import { REVIEW_ANALYSIS, useMoveCoach, type MoveReview } from '@/widgets/Chess/Coach'
import { hintArrows, type HintArrow } from '@/shared/lib/chess/hintArrows'
import { getEngine, type EngineLine } from '@/shared/lib/chess/engine'
import { playMoveSound } from '@/shared/lib/chess/sound'
import { readPref, useLocalPref } from '@/shared/lib/chess/localPref'
import { bookMove, getBot, levelBot } from '@/shared/lib/chess/data'
import { useBotGameActivity } from '@/widgets/Chess/Progress'
import type { BotChoice } from '@/widgets/Chess/Settings'
import { endReason, engineMoveFacts, type MoveFact } from '@/shared/lib/chess/gameFacts'

export type Side = 'w' | 'b'
type Mode = 'ai' | 'duo'
// `level` stays in the save for old saves without `botId`; the bot's level is the source of truth
type Saved = { start: string; moves: string[]; level: number; botId?: string; color: Side; mode: Mode; resigned: boolean; evalCp: number | null; coach: boolean }
/** A fresh game asked for by the URL (`/chess/play?new=bot&bot=<id>&color=w&coach=1` or `?new=duo`, from the hub's modal). */
export type StartRequest = { mode: Mode; botId?: string; color?: Side; coach?: boolean }
export type EngineNote = { fenBefore: string; uci: string; san: string; facts: MoveFact[] }

const STORE = 'gw-chess-game'
const isLevel = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 8

function soundFor(chess: Chess) {
  const last = chess.history({ verbose: true }).at(-1)
  if (chess.isGameOver()) return playMoveSound('end')
  if (chess.inCheck()) return playMoveSound('check')
  playMoveSound(last?.captured ? 'capture' : 'move')
}

/**
 * A game against a bot (or two players on one board): position, save/restore, the engine's reply and the bot's book,
 * hint arrows, the coach's review and the generation counter that drops stale engine answers. The page only lays it out.
 */
export function useBotGame({ initialFen, initialColor, startNew }: { initialFen?: string; initialColor?: string; startNew?: StartRequest }) {
  'use no memo' // the game lives in one mutable chess.js object: derived values must be re-read on every render
  const router = useRouter()
  const [chess] = useState(() => new Chess())
  const [start, setStart] = useState(DEFAULT_POSITION)
  const [fen, setFen] = useState(DEFAULT_POSITION)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [mode, setMode] = useState<Mode>('ai')
  const [botId, setBotId] = useState(() => levelBot(3).id)
  const bot = getBot(botId) ?? levelBot(3)
  const level = bot.level
  const [color, setColor] = useState<Side>('w')
  const [flipped, setFlipped] = useState(false)
  const [resigned, setResigned] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [engineDown, setEngineDown] = useState(false)
  const [review, setReview] = useState<MoveReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [noAnalysis, setNoAnalysis] = useState(false)
  const [evalCp, setEvalCp] = useState<number | null>(0) // null = unknown for this position: the bar is hidden
  const [note, setNote] = useState<EngineNote | null>(null)
  const [ready, setReady] = useState(false)
  const [badFen, setBadFen] = useState(false)
  const [round, setRound] = useState(0) // re-asks the engine after a reset even when fen did not change
  const [coachPick, setCoachPick] = useState(true) // "with / without coach" of this game (New game modal)
  const [pending, setPending] = useState<{ move: BoardMove; fen: string; san: string } | null>(null) // move awaiting "Confirm"
  const [hintPref] = useLocalPref('gw-chess-hints', '1')
  const [hint, setHint] = useState<{ fen: string; lines: EngineLine[]; arrows: HintArrow[] } | null>(null)
  const [confirmPref] = useLocalPref('gw-chess-confirm', '0')
  const coach = useMoveCoach()
  const gen = useRef(0) // bumps on every player move / new game / undo: stale engine answers are dropped
  const askedFen = useRef<string | null>(null)
  const booted = useRef(false)

  const sync = useCallback(() => {
    setFen(chess.fen())
    const last = chess.history({ verbose: true }).at(-1)
    setLastMove(last ? { from: last.from, to: last.to } : null)
  }, [chess])

  const vsAi = mode === 'ai' && !engineDown
  const coachOn = vsAi && coachPick
  const reason = endReason(chess, resigned)
  const gameOver = reason !== null
  useBotGameActivity({ active: ready && vsAi, over: gameOver, level, plies: chess.history().length, result: reason === 'resign' || (reason === 'checkmate' && chess.turn() === color) ? 'loss' : reason === 'checkmate' ? 'win' : 'draw' })

  // ─── restore: ?fen= (from "play on from here") wins over the saved game ──────
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    let fromUrl = false
    if (startNew) {
      fromUrl = true
      setMode(startNew.mode)
      if (getBot(startNew.botId)) setBotId(startNew.botId!)
      if (startNew.color) setColor(startNew.color)
      if (typeof startNew.coach === 'boolean') setCoachPick(startNew.coach)
      router.replace('/chess/play')
    } else if (initialFen) {
      if (validateFen(initialFen).ok) {
        chess.load(initialFen)
        setStart(initialFen)
        setColor(initialColor === 'w' || initialColor === 'b' ? initialColor : chess.turn())
        fromUrl = true
        setEvalCp(null)
        try {
          const sv = JSON.parse(readPref(STORE) ?? 'null') as Saved | null // keep the player's bot
          if (getBot(sv?.botId)) setBotId(sv!.botId!)
          else if (isLevel(sv?.level)) setBotId(levelBot(sv.level).id)
        } catch {}
      } else setBadFen(true) // inline, not a toast: the site Toaster mounts lazily and misses toasts fired on load
      router.replace('/chess/play')
    }
    if (!fromUrl) {
      try {
        const s = JSON.parse(readPref(STORE) ?? 'null') as Saved | null
        if (s && typeof s.start === 'string' && Array.isArray(s.moves)) {
          chess.load(s.start)
          for (const san of s.moves) chess.move(san)
          setStart(s.start)
          if (getBot(s.botId)) setBotId(s.botId!)
          else if (isLevel(s.level)) setBotId(levelBot(s.level).id)
          if (s.color === 'w' || s.color === 'b') setColor(s.color)
          if (s.mode === 'ai' || s.mode === 'duo') setMode(s.mode)
          if (typeof s.resigned === 'boolean') setResigned(s.resigned)
          if (typeof s.coach === 'boolean') setCoachPick(s.coach)
          setEvalCp(typeof s.evalCp === 'number' && Number.isFinite(s.evalCp) ? s.evalCp : null)
        }
      } catch {
        chess.reset() // corrupted save: plain new game
      }
    }
    sync()
    setReady(true)
  }, [chess, initialColor, initialFen, router, startNew, sync])

  useEffect(() => {
    if (!ready) return
    const saved: Saved = { start, moves: chess.history(), level, botId, color, mode, resigned, evalCp, coach: coachPick }
    try {
      localStorage.setItem(STORE, JSON.stringify(saved))
    } catch {}
  }, [ready, chess, fen, start, level, botId, color, mode, resigned, evalCp, coachPick])

  // ─── engine reply ─────────────────────────────────────────────────────────────
  const engineMove = useCallback(async () => {
    if (!ready || !vsAi || resigned || chess.turn() === color || chess.isGameOver()) return
    const my = gen.current
    const asked = chess.fen()
    if (askedFen.current === asked) return
    askedFen.current = asked
    setThinking(true)
    try {
      // a special bot plays its favourite opening while the game follows it, then the engine
      const book = bookMove(bot, start === DEFAULT_POSITION, chess.history())
      const bookUci = book ? (() => {
        const m = new Chess(asked).move(book)
        return m.from + m.to + (m.promotion ?? '')
      })() : null
      if (bookUci) await new Promise((r) => setTimeout(r, 350)) // a human beat instead of an instant reply
      const uci = bookUci ?? (await getEngine().bestMove(asked, level))
      if (my !== gen.current || chess.fen() !== asked) return
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      sync()
      soundFor(chess)
      setNote({ fenBefore: asked, uci, ...engineMoveFacts(asked, uci) })
    } catch (e) {
      if ((e as Error).message === 'ENGINE_UNAVAILABLE') setEngineDown(true)
    } finally {
      if (askedFen.current === asked) askedFen.current = null
      if (my === gen.current) setThinking(false)
    }
  }, [bot, chess, color, level, ready, resigned, start, sync, vsAi])

  useEffect(() => {
    void engineMove()
  }, [fen, engineMove, round])

  const onMove = (m: BoardMove) => {
    if (gameOver || thinking || (vsAi && chess.turn() !== color)) return
    if (confirmPref !== '1') return play(m)
    const preview = new Chess(chess.fen())
    try {
      const done = preview.move(m)
      setPending({ move: m, fen: preview.fen(), san: done.san })
    } catch {}
  }

  const play = (m: BoardMove) => {
    setPending(null)
    const before = chess.fen()
    try {
      chess.move(m)
    } catch {
      return
    }
    gen.current++
    // the previous move's review is obsolete — drop it so the reply is not queued behind it (level 8 ≤ 3 s)
    if (vsAi) getEngine().cancelAll()
    askedFen.current = null
    setNote(null)
    sync()
    soundFor(chess)
    void engineMove() // queued first; the review goes after it
    if (!coachOn) return
    const my = gen.current
    setReview(null)
    setNoAnalysis(false)
    setReviewing(true)
    coach
      .review(before, m.from + m.to + (m.promotion ?? ''), 'game', hint?.fen === before ? hint.lines : undefined)
      .then((r) => {
        if (my !== gen.current) return
        setReview(r)
        setEvalCp(r.evalAfterCp)
      })
      .catch((e: Error) => {
        if (my !== gen.current || e.message === 'ENGINE_CANCELLED') return
        setReview(null)
        setNoAnalysis(true)
      })
      .finally(() => my === gen.current && setReviewing(false))
  }

  const reset = () => {
    gen.current++
    askedFen.current = null
    getEngine().cancelAll()
    setThinking(false)
    setReviewing(false)
    setReview(null)
    setNoAnalysis(false)
    setResigned(false)
    setNote(null)
    setRound((r) => r + 1)
    setBadFen(false)
    setPending(null)
  }

  const newGame = (side: Side = color) => {
    reset()
    chess.load(DEFAULT_POSITION)
    setStart(DEFAULT_POSITION)
    setColor(side)
    setEvalCp(0)
    sync()
  }

  const undo = () => {
    reset()
    chess.undo()
    if (vsAi && chess.turn() !== color) chess.undo()
    setEvalCp(null) // the shown eval belonged to the undone position
    sync()
  }

  const resign = () => {
    reset()
    setResigned(true)
    playMoveSound('end')
  }

  // New game modal: a fresh game with the chosen opponent; the level never changes mid-game
  const startBot = (c: BotChoice) => {
    setMode('ai')
    setBotId(c.botId)
    setCoachPick(c.coach)
    newGame(c.color)
  }
  const startDuo = () => {
    setMode('duo')
    newGame()
  }

  // ─── G01/G03: best moves of the position the player is to move in ────────────
  // Queued after the reply and the review; the next player move's cancelAll() drops it, so it never delays the engine.
  const hintOn = coachOn && hintPref === '1' && ready && !gameOver && !thinking && chess.turn() === color
  useEffect(() => {
    if (!hintOn) return
    const my = gen.current
    getEngine()
      .analyse(fen, REVIEW_ANALYSIS) // same search as the review's: the player's move reuses these lines
      .then((lines) => my === gen.current && chess.fen() === fen && setHint({ fen, lines, arrows: hintArrows(lines) }))
      .catch((e: Error) => e.message === 'ENGINE_UNAVAILABLE' && setEngineDown(true)) // cancelled / bad FEN: no arrows
  }, [hintOn, fen, chess])


  const orientation: Side = (vsAi ? color === 'b' : false) !== flipped ? 'b' : 'w'
  const arrows = hintOn && !pending && hint?.fen === fen ? hint.arrows : []

  return {
    history: chess.history(), turn: chess.turn(), start, fen, lastMove, mode, bot, color, orientation, setFlipped, thinking, engineDown, review, reviewing, noAnalysis,
    evalCp, note, ready, badFen, pending, setPending, vsAi, coachOn, coachPick, reason, gameOver, arrows, coach,
    onMove, play, newGame, undo, resign, startBot, startDuo,
  }
}
