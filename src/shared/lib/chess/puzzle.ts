import {Chess, validateFen} from 'chess.js'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** What the student's CHESS_PUZZLE answer carries into scoring. */
export interface ChessPuzzleAnswer {
  done: boolean
  mistakes: number
}

export type PuzzleStep = {ok: false} | {ok: true; reply: string | null; done: boolean}

const toUci = (m: {from: string; to: string; promotion?: string}) => m.from + m.to + (m.promotion ?? '')

/** Plays a UCI move on `fen`. Returns null for an illegal move or a broken FEN. */
export function playUci(fen: string, uci: string) {
  try {
    const game = new Chess(fen)
    const m = game.move({from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4]})
    return {fen: game.fen(), san: m.san, from: m.from, to: m.to, uci: toUci(m)}
  } catch {
    return null
  }
}

/** Plays a whole UCI line; returns the SAN of each move (stops at the first illegal one). */
export function lineToSan(fen: string, ucis: string[]): string[] {
  const out: string[] = []
  let cur = fen
  for (const uci of ucis) {
    const r = playUci(cur, uci)
    if (!r) break
    out.push(r.san)
    cur = r.fen
  }
  return out
}

/** Pads a partial FEN (e.g. placement only) with defaults: white to move, no castling, move 1. */
export function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/)
  const defaults = ['', 'w', '-', '-', '0', '1']
  return defaults.map((d, i) => parts[i] ?? d).join(' ')
}

export type FenErrorCode = 'kings' | 'pawns' | 'check' | 'format'

/** Why a FEN can't be used as a starting position; null when it can. */
export function fenError(fen: string): FenErrorCode | null {
  const v = validateFen(fen)
  if (!v.ok) {
    const e = v.error ?? ''
    if (e.includes('king')) return 'kings'
    if (e.includes('pawns')) return 'pawns'
    return 'format'
  }
  // The side that just moved can't be left in check.
  const parts = fen.split(' ')
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  parts[3] = '-'
  try {
    if (new Chess(parts.join(' ')).inCheck()) return 'check'
  } catch {
    return 'format'
  }
  return null
}

/**
 * Checks the student's move at `ply` (even plies are the student's) against `solution`.
 * Any move that mates also counts — a puzzle never rejects a correct mate.
 */
export function checkPuzzleMove(fen: string, solution: string[], ply: number, uci: string): PuzzleStep {
  const played = playUci(fen, uci)
  if (!played) return {ok: false}
  const expected = solution[ply]
  const mates = new Chess(played.fen).isCheckmate()
  if (played.uci !== expected && !mates) return {ok: false}
  const reply = mates ? null : (solution[ply + 1] ?? null)
  return {ok: true, reply, done: mates || ply + 2 >= solution.length}
}

/** All or nothing: solved with no wrong tries. */
export const scorePuzzle = (a: ChessPuzzleAnswer): 0 | 1 => (a.done && a.mistakes === 0 ? 1 : 0)

/** Square of the king in check on `fen`, for the board's check marker. */
export function checkSquare(fen: string): string | null {
  try {
    const g = new Chess(fen)
    if (!g.inCheck()) return null
    for (const row of g.board()) for (const p of row) if (p?.type === 'k' && p.color === g.turn()) return p.square
  } catch {
    // broken FEN: no marker
  }
  return null
}
