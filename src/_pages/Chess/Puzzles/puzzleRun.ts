// Thin adapter of the Lichess puzzle format over the shared solver (@/shared/lib/chess/puzzle):
// Lichess `moves[0]` is the opponent's move, the solution is `moves.slice(1)` (student first).
import { Chess } from 'chess.js'
import { checkPuzzleMove, playUci } from '@/shared/lib/chess/puzzle'

export type Sq = { from: string; to: string }
export type PuzzleRun = {
  fen: string
  solution: string[]
  /** index in `solution` of the next move to be played */
  ply: number
  lastMove: Sq | null
  /** wrong tries and hints taken anywhere in this puzzle */
  mistakes: number
  hints: number
}
export type Attempt = { ok: false; run: PuzzleRun } | { ok: true; run: PuzzleRun; done: boolean }

const sq = (uci: string): Sq => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) })

export function startRun(p: { fen: string; moves: string[] }): PuzzleRun {
  return { fen: playUci(p.fen, p.moves[0])!.fen, solution: p.moves.slice(1), ply: 0, lastMove: sq(p.moves[0]), mistakes: 0, hints: 0 }
}

/** Plays the opponent's answer from the solution. */
export function replyMove(run: PuzzleRun): PuzzleRun {
  const uci = run.solution[run.ply]
  return { ...run, fen: playUci(run.fen, uci)!.fen, ply: run.ply + 1, lastMove: sq(uci) }
}

/** The solver's side for the whole puzzle: the side to move after the opponent's first move. */
export const playerColor = (p: { fen: string }): 'w' | 'b' => (new Chess(p.fen).turn() === 'w' ? 'b' : 'w')

export const hintMove = (run: PuzzleRun): Sq => sq(run.solution[run.ply])

/** Records a hint taken on the current move (any step of it). */
export const takeHint = (run: PuzzleRun): PuzzleRun => ({ ...run, hints: run.hints + 1 })

export function tryMove(run: PuzzleRun, uci: string): Attempt {
  const step = checkPuzzleMove(run.fen, run.solution, run.ply, uci)
  if (!step.ok) return { ok: false, run: { ...run, mistakes: run.mistakes + 1 } }
  return { ok: true, run: { ...run, fen: playUci(run.fen, uci)!.fen, ply: run.ply + 1, lastMove: sq(uci) }, done: step.done }
}

/**
 * Outcome sent as `solved` to POST /api/chess/puzzles/[id]/attempt.
 * The first wrong try or the first hint, on any move of the puzzle, makes it `solved:false`;
 * only a solve with neither counts as solved.
 */
export const isCleanSolve = (run: PuzzleRun): boolean => run.mistakes === 0 && run.hints === 0

/** Sound for `uci` played from `fenBefore`. */
export function soundKind(fenBefore: string, uci: string): 'move' | 'capture' | 'check' | 'end' {
  const g = new Chess(fenBefore)
  const m = g.move({ ...sq(uci), promotion: uci[4] })
  return g.isGameOver() ? 'end' : g.inCheck() ? 'check' : m.captured ? 'capture' : 'move'
}
