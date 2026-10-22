// Self-check for pageAutoCrop.ts's detection + warp on synthetic "photos" —
// run with `npx tsx src/shared/lib/pageAutoCrop.selfcheck.ts`. No test runner
// in this project; no DB or browser needed (pure pixel functions only).
import { detectPageQuad, homography, orderQuad, outputSize, warpQuad, type Point, type Quad } from './pageAutoCrop'

let failures = 0
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++
    console.error(`FAIL ${label}`)
  } else {
    console.log(`PASS ${label}`)
  }
}

function inside(p: Point, q: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4]
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false
  }
  return true
}

// Tilted squared-notebook sheet (grid lines + "handwriting") on a noisy wooden table.
function synthPhoto(w: number, h: number, page: Quad | null, bg: [number, number, number]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4)
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let c: number[] = bg.map(v => v + (rnd() - 0.5) * 30)
      if (page && inside({ x: x + 0.5, y: y + 0.5 }, page)) {
        const shade = 235 - (y / h) * 25 // uneven lighting
        c = [shade, shade, shade - 5]
        if (x % 12 === 0 || y % 12 === 0) c = [150, 170, 215]           // blue grid
        if (y % 36 < 3 && (x * 7 + y) % 23 < 9) c = [40, 40, 90]          // pen strokes
      }
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255
    }
  }
  return px
}

const W = 400, H = 300
const page: Quad = [{ x: 90, y: 40 }, { x: 330, y: 70 }, { x: 300, y: 270 }, { x: 60, y: 240 }]
const found = detectPageQuad(synthPhoto(W, H, page, [120, 80, 45]), W, H)
assert(found !== null, 'finds a tilted notebook page on a wooden table')
if (found) {
  const maxErr = Math.max(...found.map((p, i) => Math.hypot(p.x - page[i].x, p.y - page[i].y)))
  assert(maxErr < 6, `corners within 6px of truth (max ${maxErr.toFixed(1)})`)
}

assert(detectPageQuad(synthPhoto(W, H, null, [120, 80, 45]), W, H) === null, 'no page → null')
const full: Quad = [{ x: -5, y: -5 }, { x: W + 5, y: -5 }, { x: W + 5, y: H + 5 }, { x: -5, y: H + 5 }]
assert(detectPageQuad(synthPhoto(W, H, full, [120, 80, 45]), W, H) === null, 'page already fills frame → null')
assert(detectPageQuad(synthPhoto(W, H, page, [232, 232, 228]), W, H) === null, 'white sheet on white desk (no contrast) → null')

const shuffled = orderQuad([page[2], page[1], page[0], page[3]])
assert(shuffled.every((p, i) => p === page[i]), 'orderQuad returns TL,TR,BR,BL')

const Hm = homography([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], page)
const map = (x: number, y: number) => { const d = Hm[6] * x + Hm[7] * y + Hm[8]; return { x: (Hm[0] * x + Hm[1] * y + Hm[2]) / d, y: (Hm[3] * x + Hm[4] * y + Hm[5]) / d } }
const br = map(10, 10)
assert(Math.abs(br.x - page[2].x) < 1e-6 && Math.abs(br.y - page[2].y) < 1e-6, 'homography maps rectangle corner onto quad corner')

if (found) {
  const src = synthPhoto(W, H, page, [120, 80, 45])
  const { width, height } = outputSize(found)
  const out = warpQuad(src, W, H, found, width, height)
  let bright = 0
  for (let i = 0; i < width * height; i++) if (Math.min(out[i * 4], out[i * 4 + 1], out[i * 4 + 2]) > 140) bright++
  assert(bright / (width * height) > 0.8, `warped output is mostly paper (${((bright / (width * height)) * 100).toFixed(0)}%)`)
}

if (failures) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll checks passed')
