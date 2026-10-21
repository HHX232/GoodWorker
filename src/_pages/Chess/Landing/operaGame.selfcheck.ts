import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { OPERA, project } from './operaGame'

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

console.log('operaGame ok')
