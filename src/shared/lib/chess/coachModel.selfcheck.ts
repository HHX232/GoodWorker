import assert from 'node:assert/strict'
import { classifyMove, cpLoss, toWhiteCp } from './coachModel'
import type { EngineLine } from './engine'

const L = (uci: string, scoreCp: number | null, mate: number | null = null): EngineLine => ({ uci, pv: [uci], scoreCp, mate })

// Played the engine's top move: always 'best', even if the opponent's reply eval wobbles.
const before = [L('e2e4', 30), L('d2d4', 25), L('g1f3', 20)]
assert.equal(classifyMove(before, L('e7e5', -35), 'e2e4'), 'best')

// Best was +30 for us; after our move the opponent stands +50 → we are at -50: 80 cp lost.
assert.equal(cpLoss(before, L('b8c6', 50), 'a2a3'), 80)
assert.equal(classifyMove(before, L('b8c6', 50), 'a2a3'), 'inaccuracy')

// Hung the queen: +20 → opponent now +880 for them.
assert.equal(classifyMove(before, L('d8d1', 880), 'd1h5'), 'blunder')

// Missed a forced mate in 2, left with only +300.
const mating = [L('d1h7', null, 2), L('c4f7', 450)]
assert.equal(classifyMove(mating, L('g8h8', -300), 'c4f7'), 'blunder')

// Already lost (mated in 2 whatever we do): delaying differently is not a blunder.
const lost = [L('g1h1', null, -2), L('g1f1', null, -2)]
assert.equal(classifyMove(lost, L('d8h4', null, 1), 'g1f1'), 'good')

// Mistake band: 200 cp lost.
assert.equal(classifyMove(before, L('x', 180), 'a2a4'), 'mistake')

// White-POV conversion: +40 for black to move is -40 for white; mate in 1 for black ≈ -100000.
assert.equal(toWhiteCp(L('e7e5', 40), 'b'), -40)
assert.equal(toWhiteCp(L('d8h4', null, 1), 'b'), -99999)
assert.equal(toWhiteCp(L('d1h5', null, 1), 'w'), 99999)

// No analysis is an explicit state, never 'best' / 0 cp.
assert.throws(() => classifyMove([], L('e7e5', 20), 'e2e4'), /NO_ANALYSIS/)
assert.throws(() => classifyMove(before, undefined, 'e2e4'), /NO_ANALYSIS/)
assert.throws(() => classifyMove(before, { uci: '', pv: [], scoreCp: null, mate: null }, 'a2a3'), /NO_ANALYSIS/)

console.log('coachModel ok')
