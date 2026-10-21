import { Chess } from 'chess.js'
import type { PieceCode } from '@/widgets/Chess/Board'
import type { ReviewClass } from '@/shared/lib/chess/reviewModel'

// The hero's script: Morphy's "Opera game" (Paris, 1858) replayed ply by ply, with coach notes on the key moves.
// Pieces keep a stable id so the scene can slide them instead of re-mounting.

const SAN = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ')

/** ply (1-based) → move class + `chess.landing` key of the coach's line */
const NOTES: Record<number, ReviewClass> = { 1: 'best', 6: 'inaccuracy', 12: 'mistake', 13: 'best', 18: 'blunder', 19: 'brilliant', 25: 'best', 31: 'brilliant', 33: 'best' }

/** seconds each ply "thinks" — an illustrative 10-minute clock, not a record of the game */
const THINK = [4, 6, 3, 9, 5, 14, 4, 7, 3, 5, 6, 18, 11, 8, 4, 6, 9, 21, 16, 7, 5, 9, 6, 12, 13, 5, 4, 10, 6, 4, 8, 3, 5]

export type ScenePiece = { id: string; code: PieceCode; sq: string | null }
export type Frame = {
  ply: number
  fen: string
  san: string | null
  from: string | null
  to: string | null
  pieces: ScenePiece[]
  /** square of the king in check / mated */
  check: string | null
  note: { cls: ReviewClass; key: string } | null
  /** seconds left for white / black after this ply */
  clock: { w: number; b: number }
}

function build(): { frames: Frame[] } {
  const g = new Chess()
  let pieces: ScenePiece[] = []
  for (const row of g.board()) for (const c of row) if (c) pieces.push({ id: c.square, code: (c.color + c.type.toUpperCase()) as PieceCode, sq: c.square })
  const clock = { w: 600, b: 600 }
  const frames: Frame[] = [{ ply: 0, fen: g.fen(), san: null, from: null, to: null, pieces, check: null, note: null, clock: { ...clock } }]

  SAN.forEach((san, i) => {
    const m = g.move(san)
    const rook = m.isKingsideCastle() ? [`h${m.from[1]}`, `f${m.from[1]}`] : m.isQueensideCastle() ? [`a${m.from[1]}`, `d${m.from[1]}`] : null
    pieces = pieces.map((p) => {
      if (p.sq === m.to) return { ...p, sq: null } // captured
      if (p.sq === m.from) return { ...p, sq: m.to, code: m.promotion ? ((m.color + m.promotion.toUpperCase()) as PieceCode) : p.code }
      if (rook && p.sq === rook[0]) return { ...p, sq: rook[1] }
      return p
    })
    clock[m.color] -= THINK[i]
    const ply = i + 1
    const king = g.inCheck() ? pieces.find((p) => p.sq && p.code === `${g.turn()}K`)?.sq ?? null : null
    frames.push({
      ply,
      fen: g.fen(),
      san: m.san,
      from: m.from,
      to: m.to,
      pieces,
      check: king,
      note: NOTES[ply] ? { cls: NOTES[ply], key: `note_${ply}` } : null,
      clock: { ...clock },
    })
  })
  return { frames }
}

export const OPERA = build()

/** the frame a still visitor sees (prefers-reduced-motion): 16.Qb8+, the queen sacrifice before mate */
export const STILL_PLY = 31

// ─── perspective ─────────────────────────────────────────────────────────────
// A square board of side 1, tilted back by TILT around its horizontal axis and seen from CAM in front of it.
// u: 0 = file a … 1 = file h; v: 0 = rank 8 (far) … 1 = rank 1 (near). Returns screen x/y (board-side units,
// centre at 0) and k — how much nearer things grow.
const TILT = (52 * Math.PI) / 180
const CAM = 2.1

export function project(u: number, v: number) {
  const X = u - 0.5
  const Y = v - 0.5
  const z = Y * Math.sin(TILT)
  const k = CAM / (CAM - z)
  return { x: X * k, y: Y * Math.cos(TILT) * k, k }
}
