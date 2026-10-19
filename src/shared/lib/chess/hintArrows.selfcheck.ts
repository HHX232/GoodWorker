import assert from 'node:assert/strict'
import { hintArrows } from './hintArrows'
import type { EngineLine } from './engine'
import { migrateSkinPref } from './localPref'

const L = (uci: string, scoreCp: number | null, mate: number | null = null): EngineLine => ({ uci, pv: [uci], scoreCp, mate })
const shape = (a: { from: string; to: string; opacity: number }[]) => a.map((x) => `${x.from}${x.to}:${x.opacity}`)

// Three distinct close scores, engine order: densest first, then 0.6, 0.35.
assert.deepEqual(shape(hintArrows([L('e2e4', 30), L('d2d4', 25), L('g1f3', 20)])), ['e2e4:1', 'd2d4:0.6', 'g1f3:0.35'])

// Engine order is not trusted: sorted by score.
assert.deepEqual(shape(hintArrows([L('g1f3', 20), L('e2e4', 30), L('d2d4', 25)])), ['e2e4:1', 'd2d4:0.6', 'g1f3:0.35'])

// Equal scores → equal density; the next distinct score takes the next step.
assert.deepEqual(shape(hintArrows([L('e2e4', 30), L('d2d4', 30), L('g1f3', 10)])), ['e2e4:1', 'd2d4:1', 'g1f3:0.6'])
assert.deepEqual(shape(hintArrows([L('e2e4', 30), L('d2d4', 10), L('g1f3', 10)])), ['e2e4:1', 'd2d4:0.6', 'g1f3:0.6'])

// Mate: shorter mate beats longer mate beats any cp; a move that throws a mate away is not "almost best".
assert.deepEqual(shape(hintArrows([L('d1h5', null, 3), L('d1h7', null, 1), L('c4f7', 900)])), ['d1h7:1', 'd1h5:0.6'])
// Getting mated: the longest defence is best.
assert.deepEqual(shape(hintArrows([L('g1h1', null, -1), L('g1f1', null, -3)])), ['g1f1:1', 'g1h1:0.6'])

// Fewer than 3 lines, an empty analysis, unscored lines.
assert.deepEqual(shape(hintArrows([L('e2e4', 30)])), ['e2e4:1'])
assert.deepEqual(hintArrows([]), [])
assert.deepEqual(shape(hintArrows([L('e2e4', 30), L('', null)])), ['e2e4:1'])

// Clearly worse lines (losing a piece) are not shown as hints.
assert.deepEqual(shape(hintArrows([L('e2e4', 30), L('d1h5', -300), L('g1f3', 20)])), ['e2e4:1', 'g1f3:0.6'])

// Promotions to different pieces are one arrow.
assert.deepEqual(shape(hintArrows([L('a7a8q', 900), L('a7a8r', 880), L('b2b3', 850)])), ['a7a8:1', 'b2b3:0.6'])

// Old single skin key → board and pieces both take its value, once; the old key is gone.
const store = (init: Record<string, string>) => {
  const m = new Map(Object.entries(init))
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const s1 = store({ 'gw-chess-skin': 'night' })
migrateSkinPref(s1)
assert.deepEqual(Object.fromEntries(s1.m), { 'gw-chess-board': 'night', 'gw-chess-pieces': 'night' })
// A choice already made with the new keys wins over the leftover old one.
const s2 = store({ 'gw-chess-skin': 'night', 'gw-chess-board': 'powder' })
migrateSkinPref(s2)
assert.deepEqual(Object.fromEntries(s2.m), { 'gw-chess-board': 'powder', 'gw-chess-pieces': 'night' })
// Nothing to migrate: nothing written.
const s3 = store({})
migrateSkinPref(s3)
assert.deepEqual(Object.fromEntries(s3.m), {})

console.log('hintArrows ok')
