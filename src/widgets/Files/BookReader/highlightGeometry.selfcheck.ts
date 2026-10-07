// Self-check for highlight geometry (highlightGeometry.ts). No test runner in this
// project: `npx tsx src/widgets/Files/BookReader/highlightGeometry.selfcheck.ts`.
// Expected values are worked out by hand on a 400×800 px page at (100,200), not by the code under test.
import assert from 'node:assert/strict'
import { clipQuote, excerpt, hitHighlight, mergeLineRects, placeFloating, rectsToFractions } from './highlightGeometry'

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`)
const sameRects = (got: { x: number; y: number; w: number; h: number }[], want: number[][], msg: string) => {
  assert.equal(got.length, want.length, `${msg}: count ${got.length} ≠ ${want.length}`)
  got.forEach((r, i) => [r.x, r.y, r.w, r.h].forEach((v, k) => near(v, want[i][k], `${msg} rect ${i}[${k}]`)))
}

const page = { left: 100, top: 200, width: 400, height: 800 }

// ── px → fractions ──
// A and B touch on line 1 → one rect; C is A's span box lying inside it → absorbed.
// D is line 2; E is on line 2 but 100 px (0.25 of the width) away → stays apart.
// F's centre is right of the page (the other page of the spread) → dropped.
// G sticks out of the page's right edge by 20 px → clamped to x=0.95, right edge 1.
// H has no height → dropped.
const A = { left: 140, top: 240, width: 100, height: 20 } // x .1  y .05  w .25  h .025
const B = { left: 240, top: 240, width: 60, height: 20 } //  x .35 → right .5
const C = { left: 150, top: 242, width: 40, height: 16 }
const D = { left: 140, top: 300, width: 200, height: 20 } // x .1  y .125 w .5   h .025
const E = { left: 440, top: 300, width: 50, height: 20 } //  x .85 y .125 w .125
const F = { left: 600, top: 240, width: 50, height: 20 }
const G = { left: 480, top: 900, width: 40, height: 20 } //  x .95 y .875 w .05 (clamped)
const H = { left: 200, top: 400, width: 80, height: 0 }
sameRects(
  rectsToFractions([G, E, F, C, D, H, B, A], page),
  [[0.1, 0.05, 0.4, 0.025], [0.1, 0.125, 0.5, 0.025], [0.85, 0.125, 0.125, 0.025], [0.95, 0.875, 0.05, 0.025]],
  'fractions',
)
// Degenerate page → nothing.
assert.deepEqual(rectsToFractions([A], { left: 0, top: 0, width: 0, height: 100 }), [])

// ── line joining ──
// Gap 4 px of a 1000 px page = 0.004 ≤ 0.006 → joined; 10 px = 0.01 → not.
const wide = { left: 0, top: 0, width: 1000, height: 1000 }
sameRects(rectsToFractions([{ left: 100, top: 100, width: 100, height: 20 }, { left: 204, top: 100, width: 100, height: 20 }], wide), [[0.1, 0.1, 0.204, 0.02]], 'gap 0.004 joins')
assert.equal(rectsToFractions([{ left: 100, top: 100, width: 100, height: 20 }, { left: 210, top: 100, width: 100, height: 20 }], wide).length, 2)
// Neighbouring lines (touching, no overlap) stay two lines; a slightly shifted rect (16 of 20 px shared = 80%) is the same line.
assert.equal(mergeLineRects([{ x: 0.1, y: 0.1, w: 0.1, h: 0.02 }, { x: 0.1, y: 0.12, w: 0.1, h: 0.02 }]).length, 2)
sameRects(mergeLineRects([{ x: 0.1, y: 0.1, w: 0.1, h: 0.02 }, { x: 0.2, y: 0.104, w: 0.1, h: 0.02 }]), [[0.1, 0.1, 0.2, 0.024]], 'shifted rect, one line')
// Output is in reading order whatever the input order.
sameRects(mergeLineRects([{ x: 0.5, y: 0.5, w: 0.1, h: 0.02 }, { x: 0.1, y: 0.1, w: 0.1, h: 0.02 }]), [[0.1, 0.1, 0.1, 0.02], [0.5, 0.5, 0.1, 0.02]], 'reading order')
// Never more than the server cap (200), however many lines.
const many = Array.from({ length: 250 }, (_, i) => ({ left: 0, top: i * 4, width: 100, height: 3 }))
assert.equal(rectsToFractions(many, { left: 0, top: 0, width: 1000, height: 1000 }).length, 200)

// ── hit test ──
const hl = [{ id: 'old', rects: [{ x: 0.1, y: 0.1, w: 0.4, h: 0.02 }] }, { id: 'new', rects: [{ x: 0.3, y: 0.1, w: 0.4, h: 0.02 }] }]
assert.equal(hitHighlight(hl, 0.2, 0.11)?.id, 'old')
assert.equal(hitHighlight(hl, 0.4, 0.11)?.id, 'new') // overlap → later wins
assert.equal(hitHighlight(hl, 0.9, 0.11), null)
assert.equal(hitHighlight(hl, 0.2, 0.1205)?.id, 'old') // 0.0005 below the rect, inside the pad
assert.equal(hitHighlight(hl, 0.2, 0.2), null)

// ── placing a floating box (360×640 phone, 300 px wide, 8 px margin) ──
const vp = { w: 360, h: 640 }
const left = placeFloating({ anchor: { left: 10, top: 300, bottom: 320, width: 60 }, width: 300, viewport: vp, prefer: 'above', need: 44 })
assert.deepEqual(left, { left: 8, bottom: 348, maxHeight: 284, side: 'above' }) // centre 40−150<8 → 8; 640−300+8; 300−8−8
const right = placeFloating({ anchor: { left: 330, top: 300, bottom: 320, width: 20 }, width: 300, viewport: vp, prefer: 'above', need: 44 })
assert.equal(right.left, 52) // 360−300−8
const top = placeFloating({ anchor: { left: 100, top: 20, bottom: 40, width: 40 }, width: 300, viewport: vp, prefer: 'above', need: 44 })
assert.deepEqual(top, { left: 8, top: 48, maxHeight: 584, side: 'below' }) // 4 px above < 44 → flips; 640−40−16
const touch = placeFloating({ anchor: { left: 100, top: 300, bottom: 320, width: 40 }, width: 300, viewport: vp, prefer: 'below', need: 44 })
assert.equal(touch.side, 'below')
assert.equal(touch.top, 328)
// No room anywhere for the preferred side and the other is worse → keep the preferred one.
assert.equal(placeFloating({ anchor: { left: 0, top: 100, bottom: 540, width: 10 }, width: 300, viewport: vp, prefer: 'above', need: 200 }).side, 'above')

// ── quote ──
assert.equal(clipQuote('  a  b\n c\t'), 'a b c')
assert.equal(clipQuote('x'.repeat(2500)).length, 2000)
assert.equal(clipQuote('x'.repeat(1999) + '😀'), 'x'.repeat(1999)) // a lone high surrogate at the cut is dropped
assert.equal(clipQuote('x'.repeat(1998) + '😀'), 'x'.repeat(1998) + '😀') // fits exactly (2 units)
assert.equal(clipQuote('hello world', 5), 'hello')
assert.equal(clipQuote(' \n '), '')

// ── list excerpt ──
assert.equal(excerpt('short'), 'short')
assert.equal(excerpt('aaaa bbbb cccc dddd', 12), 'aaaa bbbb…') // cut at the last space inside 12 chars
assert.equal(excerpt('x'.repeat(30), 10), 'x'.repeat(10) + '…') // no space near the end → hard cut

// ── edge cases ──
// Nothing in → nothing out.
assert.deepEqual(rectsToFractions([], page), [])
assert.deepEqual(mergeLineRects([]), [])
assert.equal(hitHighlight([], 0.5, 0.5), null)
// Clamped on the left and top: the rect starts 20 px before the page's left/top edge → x=0, y=0; right edge (140−100)/400=0.1, bottom (220−200)/800=0.025.
sameRects(rectsToFractions([{ left: 80, top: 180, width: 60, height: 40 }], page), [[0, 0, 0.1, 0.025]], 'clamp left/top')
// Clamped at the bottom: from y=(980−200)/800=0.975, bottom 1020 → 1, so h=0.025.
sameRects(rectsToFractions([{ left: 140, top: 980, width: 100, height: 40 }], page), [[0.1, 0.975, 0.25, 0.025]], 'clamp bottom')
// Join gap threshold is exactly 0.006 of the page width: a gap of 0.006 joins, 0.0061 does not.
assert.equal(mergeLineRects([{ x: 0.1, y: 0.1, w: 0.1, h: 0.02 }, { x: 0.206, y: 0.1, w: 0.1, h: 0.02 }]).length, 1)
assert.equal(mergeLineRects([{ x: 0.1, y: 0.1, w: 0.1, h: 0.02 }, { x: 0.2061, y: 0.1, w: 0.1, h: 0.02 }]).length, 2)
// Minimum side is 0.0005 of the page: 5 px of a 10000 px page is kept, 4 px is an artefact.
const huge = { left: 0, top: 0, width: 10000, height: 10000 }
assert.equal(rectsToFractions([{ left: 1000, top: 1000, width: 5, height: 100 }], huge).length, 1)
assert.equal(rectsToFractions([{ left: 1000, top: 1000, width: 4, height: 100 }], huge).length, 0)
assert.equal(rectsToFractions([{ left: 1000, top: 1000, width: 100, height: 4 }], huge).length, 0)
// A box wider than the viewport (400 in 360) still starts at the margin, never off the left edge.
assert.equal(placeFloating({ anchor: { left: 100, top: 300, bottom: 320, width: 40 }, width: 400, viewport: vp, prefer: 'above', need: 44 }).left, 8)

console.log('highlightGeometry.selfcheck: ok')
