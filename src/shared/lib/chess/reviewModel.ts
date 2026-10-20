// Game review (spec «Дополнение 2026-10-19 (вечер)»): every move classified by the win% it gave up.
// Pure: engine lines in, classes / accuracy / counts out.
import { Chess, DEFAULT_POSITION } from 'chess.js'
import { OPENINGS } from './data'
import type { EngineLine } from './engine'
import { sideToMoveCp, toWhiteCp, type MoveClass } from './coachModel'

/** Win chance 0..100 for the side whose score `cp` is (mate scores ±100000 saturate to 0 / 100). */
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/** Accuracy of a side from its average win% loss, clamped to 0..100. */
export function accuracy(avgLoss: number): number {
  return Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669))
}

export type ReviewClass =
  | 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder'

/** Display order (chess.com card). */
export const REVIEW_CLASSES: ReviewClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder']

export type ReviewInput = {
  initialFen: string
  /** UCI, in order */
  moves: string[]
  /**
   * Engine lines (MultiPV ≥ 2) of every position, `analyses[i]` = before move i, `analyses[moves.length]` = final position;
   * scored for the side to move. Game-over positions may be `[]` — the model scores them itself (mate / draw).
   */
  analyses: EngineLine[][]
}

export type ReviewedMove = {
  ply: number
  color: 'w' | 'b'
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  cls: ReviewClass
  /** win% the mover gave up vs the engine's best (≥ 0) */
  loss: number
  /** mover's win% before (best play) and after the move */
  winBefore: number
  winAfter: number
  /** White's win% after the move — the eval graph */
  whiteWin: number
  bestUci: string
  bestSan: string
  pvUci: string[]
  /** White's point of view — what /api/chess/coach takes */
  evalBeforeCp: number
  evalAfterCp: number
}

export type ClassCounts = Record<ReviewClass, number>

export type GameReview = {
  moves: ReviewedMove[]
  accuracy: { w: number; b: number }
  counts: { w: ClassCounts; b: ClassCounts }
  /** plies worth a look: brilliant / great / miss / mistake / blunder */
  keyMoments: number[]
}

export const KEY_CLASSES: ReviewClass[] = ['brilliant', 'great', 'miss', 'mistake', 'blunder']

/** The five classes /api/chess/coach takes. */
export function coachClass(cls: ReviewClass): MoveClass {
  if (cls === 'brilliant' || cls === 'great' || cls === 'book' || cls === 'best') return 'best'
  if (cls === 'excellent' || cls === 'good') return 'good'
  if (cls === 'miss') return 'mistake'
  return cls
}

export type LoadedGame = { initialFen: string; moves: string[] /*UCI*/; white?: string; black?: string; result?: string }

/** A PGN, or a SAN/UCI move list from `initialFen` (default: the start), → UCI moves. Anything illegal → null. */
export function loadGame(src: { pgn?: string; moves?: string[]; initialFen?: string }): LoadedGame | null {
  try {
    const game = new Chess(src.initialFen || DEFAULT_POSITION)
    if (src.pgn !== undefined) {
      if (!src.pgn.trim()) return null
      game.loadPgn(src.pgn)
    } else {
      if (!src.moves?.length) return null
      for (const m of src.moves) game.move(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m) ? uciMove(m) : m)
    }
    const h = game.getHeaders()
    const initialFen = h.FEN || src.initialFen || DEFAULT_POSITION
    const moves = game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''))
    return { initialFen, moves, white: h.White || undefined, black: h.Black || undefined, result: h.Result && h.Result !== '*' ? h.Result : undefined }
  } catch {
    return null
  }
}

const scored = (l: EngineLine | undefined): l is EngineLine => !!l && (l.scoreCp != null || l.mate != null)
const uciMove = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })

function sanOf(fen: string, uci: string): string {
  try {
    return new Chess(fen).move(uciMove(uci)).san
  } catch {
    return uci
  }
}

/** Lines of position `i`: the engine's, or the game result for a finished position. Throws NO_ANALYSIS. */
function linesAt(game: Chess, lines: EngineLine[] | undefined): EngineLine[] {
  if (game.isCheckmate()) return [{ uci: '', pv: [], scoreCp: null, mate: 0 }]
  if (game.isGameOver()) return [{ uci: '', pv: [], scoreCp: 0, mate: null }]
  if (!lines || !scored(lines[0])) throw new Error('NO_ANALYSIS')
  return lines
}

function byLoss(loss: number): ReviewClass {
  if (loss <= 2) return 'excellent'
  if (loss <= 5) return 'good'
  if (loss <= 10) return 'inaccuracy'
  if (loss <= 20) return 'mistake'
  return 'blunder'
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/**
 * Material the move offers (pawns), `game` = position after the move, opponent to move: the opponent's best
 * capture of the piece that just moved, on `to` (full value if nothing takes back, else value − capturer),
 * minus what the move itself took. ≥ 2 → sacrifice. A piece that hung before the move is not offered by it.
 * One exchange deep: 13.Rxd7 in the Opera game nets even material after the trades, so a full SEE would not call
 * it a sacrifice either (a positional sac, spec D06). ponytail: discovered sacs (a move that exposes another
 * piece) are not seen — compare the opponent's captures before/after the move if they are needed.
 */
function offered(game: Chess, to: string, taken: number): number {
  let best = 0
  for (const cap of game.moves({ verbose: true })) {
    if (!cap.captured || cap.to !== to) continue
    game.move(cap)
    const retaken = game.moves({ verbose: true }).some((m) => m.to === cap.to && m.captured)
    game.undo()
    best = Math.max(best, VALUE[cap.captured] - (retaken ? VALUE[cap.piece] : 0))
  }
  return best - taken
}

const BOOK_PLIES = 20
/** The game so far (SAN, this move included) is a prefix of one of OPENINGS' main lines. */
const inBook = (sans: string[]) =>
  sans.length <= BOOK_PLIES && OPENINGS.some((o) => sans.length <= o.moves.length && sans.every((m, i) => o.moves[i] === m))

/** Throws Error('NO_ANALYSIS') when an unfinished position has no scored line, Error('BAD_MOVE') on an illegal move. */
export function reviewGame({ initialFen, moves, analyses }: ReviewInput): GameReview {
  const game = new Chess(initialFen)
  const out: ReviewedMove[] = []
  const fromStart = game.fen().split(' ').slice(0, 4).join(' ') === DEFAULT_POSITION.split(' ').slice(0, 4).join(' ')
  const sans: string[] = []
  let before = linesAt(game, analyses[0])
  for (let i = 0; i < moves.length; i++) {
    const fenBefore = game.fen()
    const color = game.turn()
    let played
    try {
      played = game.move(uciMove(moves[i]))
    } catch {
      throw new Error('BAD_MOVE')
    }
    sans.push(played.san)
    const uci = played.from + played.to + (played.promotion ?? '')
    const after = linesAt(game, analyses[i + 1])
    const top = before[0]
    const winBefore = winPct(sideToMoveCp(top))
    const winAfter = 100 - winPct(sideToMoveCp(after[0]))
    const book = fromStart && inBook(sans)
    const isBest = top.uci === uci
    const loss = book || isBest ? 0 : Math.max(0, winBefore - winAfter)
    // "not crushing before" (spec D04): judged by the best line other than the played move — a sac that is the only
    // win shows as ~100% in the engine's own top line, so the top line alone would never let a mating sac be brilliant
    const alt = before.find((l) => l.uci !== uci) ?? top
    const brilliant = loss <= 2 && winPct(sideToMoveCp(alt)) < 90 && offered(game, played.to, played.captured ? VALUE[played.captured] : 0) >= 2
    const second = before[1]
    // great = the only move: the next line is ≥ 15% worse (spec D05: no separate "lost → equal" branch)
    const great = isBest && scored(second) && winBefore - winPct(sideToMoveCp(second)) >= 15
    // miss: the opponent's last move was a mistake/blunder that handed us ≥ 20%, and we gave ≥ 10% of it back
    const prev = out[i - 1]
    const chance = prev && (prev.cls === 'mistake' || prev.cls === 'blunder') && winBefore - (100 - prev.winBefore) >= 20
    const cls: ReviewClass = book
      ? 'book'
      : brilliant
        ? 'brilliant'
        : great
          ? 'great'
          : isBest
            ? 'best'
            : chance && loss >= 10 && loss <= 20
              ? 'miss'
              : byLoss(loss)
    out.push({
      ply: i,
      color,
      san: played.san,
      uci,
      fenBefore,
      fenAfter: game.fen(),
      cls,
      loss,
      winBefore,
      winAfter,
      whiteWin: color === 'w' ? winAfter : 100 - winAfter,
      bestUci: top.uci,
      bestSan: sanOf(fenBefore, top.uci),
      pvUci: top.pv,
      evalBeforeCp: toWhiteCp(top, color),
      evalAfterCp: toWhiteCp(after[0], game.turn()),
    })
    before = after
  }
  const side = (c: 'w' | 'b') => out.filter((m) => m.color === c)
  const count = (c: 'w' | 'b') => {
    const n = Object.fromEntries(REVIEW_CLASSES.map((k) => [k, 0])) as ClassCounts
    for (const m of side(c)) n[m.cls]++
    return n
  }
  const acc = (c: 'w' | 'b') => {
    const ms = side(c)
    return ms.length ? accuracy(ms.reduce((s, m) => s + m.loss, 0) / ms.length) : 100
  }
  return {
    moves: out,
    accuracy: { w: acc('w'), b: acc('b') },
    counts: { w: count('w'), b: count('b') },
    keyMoments: out.filter((m) => KEY_CLASSES.includes(m.cls)).map((m) => m.ply),
  }
}
