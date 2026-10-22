// Pure chess.js tactics for the coach (G41–G43): WHY a move loses — what the opponent's refutation does
// (fork, pin, skewer, discovered attack, overloaded defender, loose piece, mate) and how the best move avoids it.
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'

export type PieceAt = { piece: PieceSymbol; square: Square }

export type Motif =
  | { k: 'mate'; n: number }
  | { k: 'fork'; by: PieceAt; targets: PieceAt[] }
  | { k: 'pin'; by: PieceAt; pinned: PieceAt; behind: PieceAt }
  | { k: 'skewer'; by: PieceAt; front: PieceAt; behind: PieceAt }
  | { k: 'discovered'; by: PieceAt; target: PieceAt }
  | { k: 'overload'; defender: PieceAt; target: PieceAt; also: PieceAt }
  | { k: 'hanging'; target: PieceAt; defended: boolean }
  | { k: 'material' }

/** How the strongest move avoids the refutation. */
export type Fix =
  | { k: 'takes'; target: PieceAt } // captures the attacking piece first
  | { k: 'saves'; piece: PieceAt } // moves the threatened piece away in advance
  | { k: 'stops' } // the refutation no longer works

export type MoveWhy = {
  /** the opponent's best answer to the played move (first move of the engine line after it) */
  reply: { uci: string; san: string; piece: PieceSymbol } | null
  /** why that answer hurts; null when no concrete tactic explains the loss */
  motif: Motif | null
  /** material the mover nets away over the line (pawns, ≥ 0; the played move's own capture counted) */
  loss: number
  /** our most valuable piece that line takes, when the loss is about that piece */
  lost: PieceSymbol | null
  best: { uci: string; san: string; fix: Fix | null; motif: Motif | null; gain: number; taken: PieceSymbol | null } | null
}

export type WhyInput = {
  fen: string
  played: string
  /** engine PV after the played move (opponent first) and its mate score for the opponent (positive = opponent mates in n) */
  reply: string[]
  replyMate: number | null
  /** engine PV of the strongest move in `fen` and its mate score for the mover */
  best: string[]
  bestMate: number | null
}

export const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const RANK: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 } // for "worth more than"
/** Plies of the engine line that count when tallying material. */
const LINE_PLIES = 4

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
const at = (chess: Chess, square: Square): PieceAt | null => {
  const p = chess.get(square)
  return p ? { piece: p.type, square } : null
}

function play(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null
  }
}

function pieces(chess: Chess, color: Color): PieceAt[] {
  const out: PieceAt[] = []
  for (const row of chess.board()) for (const p of row) if (p && p.color === color) out.push({ piece: p.type, square: p.square })
  return out
}

const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIRS: Record<'b' | 'r' | 'q', number[][]> = { b: DIAG, r: ORTH, q: [...DIAG, ...ORTH] }

/** The first two pieces met walking from `from` in direction (df, dr). */
function firstTwo(chess: Chess, from: Square, df: number, dr: number) {
  const found: { type: PieceSymbol; color: Color; square: Square }[] = []
  let f = from.charCodeAt(0) - 97 + df
  let r = Number(from[1]) - 1 + dr
  while (f >= 0 && f < 8 && r >= 0 && r < 8 && found.length < 2) {
    const sq = (String.fromCharCode(97 + f) + (r + 1)) as Square
    const p = chess.get(sq)
    if (p) found.push({ type: p.type, color: p.color, square: sq })
    f += df
    r += dr
  }
  return found
}

const byWorth =(a: PieceAt, b: PieceAt) => RANK[b.piece] - RANK[a.piece]

/** Material (pawns) the side to move in `fen` nets over the first plies of `line`; stops at an illegal move. */
function lineGain(fen: string, line: string[]): { gain: number; taken: PieceSymbol | null } {
  const chess = new Chess(fen)
  const me = chess.turn()
  let plies = Math.min(line.length, LINE_PLIES)
  if (plies % 2 === 1 && line.length > plies) plies++ // let our recapture in
  let gain = 0
  let taken: PieceSymbol | null = null // the most valuable piece the line's side captures
  for (const uci of line.slice(0, plies)) {
    const m = play(chess, uci)
    if (!m) break
    const v = (m.captured ? VALUE[m.captured] : 0) + (m.promotion ? VALUE[m.promotion] - 1 : 0)
    if (m.color !== me) gain -= v
    else {
      gain += v
      if (m.captured && (!taken || VALUE[m.captured] > VALUE[taken])) taken = m.captured
    }
  }
  return { gain, taken }
}

/**
 * The tactic the first move of `line` (played by the side to move in `fen`) carries out, by priority:
 * mate → fork → pin/skewer → discovered attack → overloaded defender → loose piece. Not gated by material.
 */
function detect(fen: string, line: string[], mate: number | null): Motif | null {
  if (mate != null && mate > 0) return { k: 'mate', n: mate }
  const board0 = new Chess(fen)
  const me = board0.turn()
  const them = other(me)
  const board1 = new Chess(fen)
  const m = line[0] ? play(board1, line[0]) : null
  if (!m) return null
  const mover = m.promotion ?? m.piece

  // a piece of theirs worth hitting: the king, something worth more than the hitter, or something undefended
  const worth = (x: PieceAt, hitter: PieceSymbol) =>
    x.piece === 'k' || RANK[x.piece] > RANK[hitter] || !board1.isAttacked(x.square, them)

  const targets = pieces(board1, them)
    .filter((x) => x.piece !== 'p' && board1.attackers(x.square, me).includes(m.to) && worth(x, mover))
    .sort(byWorth)
  if (targets.length >= 2) return { k: 'fork', by: { piece: mover, square: m.to }, targets: targets.slice(0, 2) }

  // pin / skewer along a line of one of our sliders: the slider just arrived, or the moved piece hits the pinned one
  for (const s of pieces(board1, me)) {
    if (s.piece !== 'b' && s.piece !== 'r' && s.piece !== 'q') continue
    for (const [df, dr] of DIRS[s.piece]) {
      const [a, b] = firstTwo(board1, s.square, df, dr)
      if (!a || !b || a.color !== them || b.color !== them) continue
      const front = { piece: a.type, square: a.square }
      const behind = { piece: b.type, square: b.square }
      if (front.piece !== 'p' && RANK[behind.piece] > RANK[front.piece]) {
        if (s.square === m.to || board1.attackers(front.square, me).includes(m.to)) return { k: 'pin', by: s, pinned: front, behind }
      } else if (s.square === m.to && behind.piece !== 'p' && RANK[front.piece] > RANK[behind.piece]) {
        return { k: 'skewer', by: s, front, behind }
      }
    }
  }

  // discovered attack: moving away opened a line — another piece of ours now hits something worth it
  for (const x of pieces(board1, them).sort(byWorth)) {
    if (x.piece === 'p') continue
    const was = board0.attackers(x.square, me)
    const by = board1.attackers(x.square, me).find((s) => s !== m.to && !was.includes(s))
    const hitter = by && at(board1, by)
    if (hitter && worth(x, hitter.piece)) return { k: 'discovered', by: hitter, target: x }
  }

  if (m.captured) {
    const target = { piece: m.captured, square: m.to }
    // overloaded defender: the captured piece had one guard, and that guard is the only one of another attacked piece
    const guards = board0.attackers(m.to, them)
    const guard = guards.length === 1 ? at(board0, guards[0]) : null
    if (guard && guard.piece !== 'k') {
      const also = pieces(board0, them)
        .filter((y) => y.square !== m.to && y.square !== guard.square && VALUE[y.piece] >= 3 && board0.isAttacked(y.square, me))
        .filter((y) => { const g = board0.attackers(y.square, them); return g.length === 1 && g[0] === guard.square })
        .sort(byWorth)[0]
      if (also) return { k: 'overload', defender: guard, target, also }
    }
    // a loose piece, or one taken by something cheaper
    if (!guards.length || RANK[m.captured] > RANK[m.piece]) return { k: 'hanging', target, defended: guards.length > 0 }
  }

  return null
}

/** Why `played` in `fen` is worse than the engine's best line. Throws Error('BAD_MOVE') on an illegal played move. */
export function whyMove(input: WhyInput): MoveWhy {
  const before = new Chess(input.fen)
  const played = play(before, input.played)
  if (!played) throw new Error('BAD_MOVE')
  const fenAfter = before.fen()

  const r = input.reply[0] ? play(new Chess(fenAfter), input.reply[0]) : null
  const reply = r ? { uci: input.reply[0], san: r.san, piece: r.piece } : null
  const { gain, taken: lost } = r ? lineGain(fenAfter, input.reply) : { gain: 0, taken: null }
  const loss = Math.max(0, gain - (played.captured ? VALUE[played.captured] : 0))
  const raw = reply ? detect(fenAfter, input.reply, input.replyMate) : null
  const motif = raw && (raw.k === 'mate' || loss >= 1) ? raw : loss >= 1 && reply ? { k: 'material' as const } : null

  let best: MoveWhy['best'] = null
  const bm = input.best[0] ? play(new Chess(input.fen), input.best[0]) : null
  if (bm) {
    const rawBest = detect(input.fen, input.best, input.bestMate)
    const { gain, taken } = lineGain(input.fen, input.best)
    best = {
      uci: input.best[0], san: bm.san, gain, taken: taken && gain >= VALUE[taken] - 2 ? taken : null,
      fix: motif && r ? fixFor(input.fen, bm, r, motif, played.to) : null,
      motif: rawBest && (rawBest.k === 'mate' || gain >= 1) ? rawBest : null,
    }
  }

  return { reply, motif, loss, lost: lost && loss >= VALUE[lost] - 2 ? lost : null, best }
}

/** Our pieces the motif hits (squares after the played move). */
export function victims(m: Motif): PieceAt[] {
  switch (m.k) {
    case 'fork': return m.targets
    case 'pin': return [m.pinned]
    case 'skewer': return [m.front, m.behind]
    case 'discovered': return [m.target]
    case 'overload': return [m.target, m.also]
    case 'hanging': return [m.target]
    default: return []
  }
}

/** How the best move `b` (played in `fen`) avoids the reply `r` and its motif. */
function fixFor(fen: string, b: Move, r: Move, motif: Motif, playedTo: Square): Fix | null {
  const board = new Chess(fen)
  // the piece that does the damage, where it stands before the reply
  const by = 'by' in motif ? motif.by.square : r.to
  const attacker = by === r.to ? r.from : by
  const hit = at(board, attacker)
  if (b.to === attacker && hit) return { k: 'takes', target: hit }
  const saved = victims(motif).find((v) => v.square === b.from && v.square !== playedTo)
  if (saved) return { k: 'saves', piece: saved }
  // after the best move, does the same reply still carry the same tactic?
  const uci = r.from + r.to + (r.promotion ?? '')
  const again = play(new Chess(b.after), uci) ? detect(b.after, [uci], null) : null
  return !again || again.k !== motif.k ? { k: 'stops' } : null
}

export type CoachMark = { from: Square; to: Square; kind: 'reply' | 'line' | 'best' }

/**
 * What to draw for a reviewed move: the refutation (`reply`), up to two lines of attack (`line`) and the best move (`best`)
 * — never more than 4 arrows — plus the squares of our pieces the motif hits.
 */
export function coachMarks(w: MoveWhy): { arrows: CoachMark[]; highlights: Square[] } {
  const arrows: CoachMark[] = []
  const r = w.reply
  if (r) arrows.push({ from: r.uci.slice(0, 2) as Square, to: r.uci.slice(2, 4) as Square, kind: 'reply' })
  const m = w.motif
  const lines: [Square, Square][] =
    !m ? []
      : m.k === 'fork' ? m.targets.map((t) => [m.by.square, t.square])
      : m.k === 'pin' ? [[m.by.square, m.behind.square]]
      : m.k === 'skewer' ? [[m.by.square, m.behind.square]]
      : m.k === 'discovered' ? [[m.by.square, m.target.square]]
      : m.k === 'overload' ? [[m.defender.square, m.target.square], [m.defender.square, m.also.square]]
      : []
  for (const [from, to] of lines.slice(0, 2)) arrows.push({ from, to, kind: 'line' })
  if (w.best) arrows.push({ from: w.best.uci.slice(0, 2) as Square, to: w.best.uci.slice(2, 4) as Square, kind: 'best' })
  return { arrows, highlights: m ? victims(m).filter((v) => m.k !== 'skewer' || v === m.front).map((v) => v.square) : [] }
}
