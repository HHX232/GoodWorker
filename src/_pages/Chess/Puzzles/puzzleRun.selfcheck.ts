// npx tsx src/_pages/Chess/Puzzles/puzzleRun.selfcheck.ts → "puzzleRun ok"
import assert from 'node:assert/strict'
import { hintMove, isCleanSolve, playerColor, replyMove, startRun, takeHint, tryMove } from './puzzleRun'

// Lichess 0042j (mateIn2): 24...dxe5 25.Qxd8+ Qxd8 26.Rxd8#
const p = { fen: '3r2k1/4nppp/pq1p1b2/1p2P3/2r2P2/2P1NR2/PP1Q2BP/3R2K1 b - - 0 24', moves: ['d6e5', 'd2d8', 'b6d8', 'd1d8'] }

const run = startRun(p)
assert.equal(playerColor(p), 'w', 'solver plays the side to move after the opponent first move')
assert.deepEqual(run.lastMove, { from: 'd6', to: 'e5' })
assert.equal(run.fen.split(' ')[0], '3r2k1/4nppp/pq3b2/1p2p3/2r2P2/2P1NR2/PP1Q2BP/3R2K1')
assert.deepEqual(hintMove(run), { from: 'd2', to: 'd8' })

assert.equal(tryMove(run, 'g1f1').ok, false, 'legal but not the solution')
assert.equal(tryMove(run, 'a1a8').ok, false, 'illegal')

/** Plays the whole solution from `r`, opponent answers included. */
function solve(r: typeof run) {
  const s1 = tryMove(r, 'd2d8')
  assert.ok(s1.ok && !s1.done)
  const r1 = replyMove(s1.run)
  assert.deepEqual(r1.lastMove, { from: 'b6', to: 'd8' }, 'opponent answer comes from the solution')
  assert.deepEqual(hintMove(r1), { from: 'd1', to: 'd8' })
  const s2 = tryMove(r1, 'd1d8')
  assert.ok(s2.ok && s2.done)
  return s2.run
}

assert.equal(isCleanSolve(solve(run)), true, 'no mistakes, no hints → solved')
assert.equal(isCleanSolve(solve(takeHint(run))), false, 'hint on the 1st move of a two-mover → not clean')
assert.equal(isCleanSolve(solve(tryMove(run, 'g1f1').run)), false, 'a wrong try, then the solution → not clean')

// Any mate ends a mate puzzle (Lichess accepts alternative mates): solution Ra8#, Rb8# mates too.
const mate = startRun({ fen: '7k/5ppp/8/8/8/8/5PPP/RR4K1 b - - 0 1', moves: ['h8g8', 'a1a8'] })
const alt = tryMove(mate, 'b1b8')
assert.ok(alt.ok && alt.done)

console.log('puzzleRun ok')
