import assert from 'node:assert/strict'
import { Chess, type Square } from 'chess.js'
import { OPERA, STILL_PLY, project } from './operaGame'

// Morphy — Duke of Brunswick & Count Isouard, Paris 1858: 17.Rd8# — 33 half-moves.
assert.equal(OPERA.frames.length, 34) // start + 33 plies
const last = OPERA.frames[33]
assert.equal(last.san, 'Rd8#')
assert.equal(last.check, 'e8') // the mated king stands on e8

// The landing's own piece tracker must agree with chess.js on every square after every ply.
const ref = new Chess()
OPERA.frames.forEach((f, i) => {
  if (i > 0) ref.move(f.san)
  const mine: Record<string, string> = {}
  for (const p of f.pieces) if (p.sq) mine[p.sq] = p.code
  const theirs: Record<string, string> = {}
  for (const row of ref.board()) for (const c of row) if (c) theirs[c.square] = c.color + c.type.toUpperCase()
  assert.deepEqual(mine, theirs, `ply ${i}`)
})
assert.ok(ref.isCheckmate())

// Coach notes sit on the moves the prototype comments: 1.e4 is best, 3…Bg4 an inaccuracy, 9…b5 the blunder.
const note = (san: string) => OPERA.frames.find((f) => f.san === san)?.note?.cls
assert.equal(note('e4'), 'best')
assert.equal(note('Bg4'), 'inaccuracy')
assert.equal(note('b5'), 'blunder')

// Perspective: the near edge (rank 1) is wider than the far edge (rank 8), the board stays left-right symmetric.
const nearW = project(1, 1).x - project(0, 1).x
const farW = project(1, 0).x - project(0, 0).x
assert.ok(nearW > farW)
assert.ok(Math.abs(project(0, 0.5).x + project(1, 0.5).x) < 1e-9)

// Recommendation arrows. best/alt — a legal move for the side to move in that frame's position.
// idea — a line the coach points at (a threat or the follow-up): legal for that piece on an otherwise empty
// board (kings kept), so the geometry is a real move of that piece even while something still stands in the way.
const withArrows = OPERA.frames.filter((f) => f.arrows.length)
assert.ok(withArrows.length >= 6)
for (const f of OPERA.frames) {
  const pos = new Chess(f.fen)
  for (const a of f.arrows) {
    if (a.kind !== 'idea') {
      assert.ok(pos.moves({ verbose: true }).some((m) => m.from === a.from && m.to === a.to), `ply ${f.ply}: ${a.from}${a.to} legal`)
      continue
    }
    const piece = pos.get(a.from as Square)
    assert.ok(piece, `ply ${f.ply}: idea ${a.from}${a.to} starts on a piece`)
    const bare = new Chess()
    bare.clear()
    for (const row of pos.board()) for (const c of row) if (c && c.type === 'k') bare.put({ type: 'k', color: c.color }, c.square)
    bare.put(piece, a.from as Square)
    const fen = bare.fen().split(' ')
    fen[1] = piece.color
    fen[2] = '-'
    fen[3] = '-'
    bare.load(fen.join(' '), { skipValidation: true })
    assert.ok(bare.moves({ verbose: true }).some((m) => m.from === a.from && m.to === a.to), `ply ${f.ply}: idea ${a.from}${a.to} is that piece's line`)
  }
  // the green arrow is the move the side to move should play; at most one per frame
  assert.ok(f.arrows.filter((a) => a.kind === 'best').length <= 1)
}
// Before the queen sacrifice: green Qb3–b8, and the yellow d-file line the rook will mate on.
const beforeSac = OPERA.frames[30]
assert.deepEqual(beforeSac.arrows.find((a) => a.kind === 'best'), { from: 'b3', to: 'b8', kind: 'best' })
assert.ok(beforeSac.arrows.some((a) => a.kind === 'idea' && a.from === 'd1' && a.to === 'd8'))
// The still frame (reduced motion) carries arrows too.
assert.ok(OPERA.frames[STILL_PLY].arrows.length > 0)

console.log('operaGame ok')
