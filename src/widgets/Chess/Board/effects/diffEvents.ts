import { Chess } from 'chess.js'
import type { PieceCode } from '../../skins'

/** What the board should celebrate when its `fen` changes. Squares are algebraic (`'e4'`). */
export type FxEvent =
  | { kind: 'capture'; square: string; code: PieceCode }
  | { kind: 'promotion'; square: string; code: PieceCode }
  | { kind: 'newGame' }
  | { kind: 'undo'; squares: string[] }
  | { kind: 'check'; square: string }
  | { kind: 'mate'; square: string }

const FILES = 'abcdefgh'
const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

type Pos = { map: Map<string, PieceCode>; turn: 'w' | 'b'; ply: number }

function parse(fen: string): Pos {
  const [placement = '', turn = 'w', , , , full = '1'] = fen.trim().split(/\s+/)
  const map = new Map<string, PieceCode>()
  placement.split('/').forEach((row, r) => {
    let f = 0
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch)
      else map.set(FILES[f++] + (8 - r), `${ch === ch.toUpperCase() ? 'w' : 'b'}${ch.toUpperCase()}` as PieceCode)
    }
  })
  const t = turn === 'b' ? 'b' : 'w'
  return { map, turn: t, ply: (Math.max(1, Number(full) || 1) - 1) * 2 + (t === 'b' ? 1 : 0) }
}

const count = (m: Map<string, PieceCode>, code: string) => {
  let n = 0
  for (const c of m.values()) if (c === code) n++
  return n
}

/**
 * Two positions (before/after) + the move that was just shown → effect events.
 * Pure: positions are compared, `lastMove` only confirms a single move when the FEN move counters are off.
 */
export function diffEvents(before: string | null, after: string, lastMove?: { from: string; to: string } | null): FxEvent[] {
  if (!before || before === after) return []
  const a = parse(before)
  const b = parse(after)
  const out: FxEvent[] = []

  // ponytail: "start position after more than one move pair" = new game; an undo back to the start
  // from ply ≤ 2 (bot games undo two plies) reads as undo. Add an explicit prop if pages need certainty.
  if (b.ply === 0 && START_PLACEMENT === after.split(' ')[0] && a.ply > 2) return [{ kind: 'newGame' }]
  // undo = back 1–2 plies touching ≤ 4 squares; anything else is an unrelated position (next puzzle, call, editor)
  let changed = 0
  for (const sq of new Set([...a.map.keys(), ...b.map.keys()])) if (a.map.get(sq) !== b.map.get(sq)) changed++
  if (a.ply - b.ply >= 1 && a.ply - b.ply <= 2 && changed <= 4) {
    const squares: string[] = []
    for (const [sq, code] of b.map) if (a.map.get(sq) !== code && count(b.map, code) > count(a.map, code)) squares.push(sq)
    return [{ kind: 'undo', squares }]
  }

  const mover = a.turn
  // one move touches ≤ 4 squares (castling 4, en passant 3)
  const singleMove =
    changed <= 4 &&
    (b.ply === a.ply + 1 ||
    (b.turn !== a.turn && !!lastMove && a.map.get(lastMove.from)?.[0] === mover && b.map.get(lastMove.to)?.[0] === mover))
  if (singleMove) {
    for (const [sq, code] of a.map) if (code[0] !== mover && b.map.get(sq) !== code) out.push({ kind: 'capture', square: sq, code })
    // the mover lost a pawn without it being captured → it promoted; the new piece is the one that wasn't there before
    if (count(b.map, `${mover}P`) < count(a.map, `${mover}P`)) {
      const last = mover === 'w' ? '8' : '1'
      for (const [sq, code] of b.map)
        if (sq[1] === last && code[0] === mover && code[1] !== 'P' && count(b.map, code) > count(a.map, code))
          out.push({ kind: 'promotion', square: sq, code })
    }
  }
  try {
    const g = new Chess(after)
    if (g.inCheck()) {
      const king = [...b.map].find(([, c]) => c === `${b.turn}K`)?.[0]
      if (king) out.push({ kind: g.isCheckmate() ? 'mate' : 'check', square: king })
    }
  } catch {
    // not a legal position (editor/puzzle setup) — no check effect
  }
  return out
}
