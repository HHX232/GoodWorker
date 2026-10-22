// Self-check for tileGrid — run with `npx tsx src/widgets/VideoRoom/hooks/tileGrid.selfcheck.ts`.
// Expected values are worked out by hand from the spec: tiles ≤ 2000×2000, ≤ 6 of them,
// otherwise the whole board is scaled down uniformly first.
import assert from 'node:assert/strict'
import { sourceRects, tileGrid } from './tileGrid'

// Small board — one tile, untouched.
assert.deepEqual(tileGrid(1000, 800), { scale: 1, tiles: [{ x: 0, y: 0, w: 1000, h: 800 }] })

// Wide board — three columns, last one is the 500 px remainder.
assert.deepEqual(tileGrid(4500, 1500), {
  scale: 1,
  tiles: [
    { x: 0, y: 0, w: 2000, h: 1500 },
    { x: 2000, y: 0, w: 2000, h: 1500 },
    { x: 4000, y: 0, w: 500, h: 1500 },
  ],
})

// 2×2 grid exactly — 4000×3000 needs 2 cols × 2 rows, no scaling.
assert.equal(tileGrid(4000, 3000).tiles.length, 4)
assert.equal(tileGrid(4000, 3000).scale, 1)

// Huge board 20000×20000: best grid within 6 tiles is 2 cols at scale 0.2 → 4000×4000 → 2×2 tiles.
const huge = tileGrid(20000, 20000)
assert.ok(Math.abs(huge.scale - 0.2) < 1e-9)
assert.deepEqual(huge.tiles, [
  { x: 0, y: 0, w: 2000, h: 2000 },
  { x: 2000, y: 0, w: 2000, h: 2000 },
  { x: 0, y: 2000, w: 2000, h: 2000 },
  { x: 2000, y: 2000, w: 2000, h: 2000 },
])
// …and in source pixels each tile is a 10000×10000 quarter of the original.
assert.deepEqual(sourceRects(20000, 20000, huge), [
  { sx: 0, sy: 0, sw: 10000, sh: 10000 },
  { sx: 10000, sy: 0, sw: 10000, sh: 10000 },
  { sx: 0, sy: 10000, sw: 10000, sh: 10000 },
  { sx: 10000, sy: 10000, sw: 10000, sh: 10000 },
])

// Long strip 13000×1000 would be 7 columns → shrink to fit 6: scale 12/13 → 12000×923 (1000·12/13 = 923.08).
const strip = tileGrid(13000, 1000)
assert.ok(Math.abs(strip.scale - 12 / 13) < 1e-9)
assert.deepEqual(strip.tiles, [0, 2000, 4000, 6000, 8000, 10000].map(x => ({ x, y: 0, w: 2000, h: 923 })))
// Source rects: 6 slices of 13000/6 = 2166.67 px, full height, edge to edge, never past the picture.
const src = sourceRects(13000, 1000, strip)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
src.forEach((r, i) => {
  assert.ok(near(r.sx, i * 13000 / 6) && near(r.sw, 13000 / 6), `strip slice ${i} x`)
  assert.ok(r.sy === 0 && r.sh === 1000, `strip slice ${i} y`)
  assert.ok(r.sx >= 0 && r.sx + r.sw <= 13000 + 1e-6)
  if (i > 0) assert.ok(near(src[i - 1].sx + src[i - 1].sw, r.sx), `strip slice ${i} adjoins`)
})
assert.ok(near(src[5].sx + src[5].sw, 13000))

// Unscaled 4500×1500: source rects equal the tiles.
assert.deepEqual(sourceRects(4500, 1500, tileGrid(4500, 1500)), [
  { sx: 0, sy: 0, sw: 2000, sh: 1500 },
  { sx: 2000, sy: 0, sw: 2000, sh: 1500 },
  { sx: 4000, sy: 0, sw: 500, sh: 1500 },
])

// Custom limits are honoured.
assert.equal(tileGrid(1000, 1000, 500, 4).tiles.length, 4)
assert.ok(tileGrid(1000, 1000, 500, 1).scale === 0.5)

console.log('tileGrid ok')
