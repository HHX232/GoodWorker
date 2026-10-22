// Auto-crop for photos of a notebook/paper page: finds the sheet's four
// corners on the photo and straightens it (perspective warp) so only the page
// is left. Pure JS on purpose — no OpenCV/WASM (several MB) for one feature.
//
// Detection works on a small downscaled copy: paper is the bright, low-colour
// region (min of R/G/B is high on white/cream paper, low on wood, fabric and
// dark tables), so: min-channel → blur → Otsu threshold → morphological close
// (bridges ruled/grid lines and handwriting) → largest blob → convex hull →
// the max-area quadrilateral on that hull. A quad that isn't clearly a page
// (too small, already the whole frame, not quad-shaped) returns null and the
// caller keeps the original photo untouched.

export type Point = { x: number; y: number }
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

const DETECT_MAX_SIDE = 480
const MAX_SOURCE_PIXELS = 16_000_000
const MAX_OUTPUT_SIDE = 4000

// ── Detection ────────────────────────────────────────────────

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0
      for (let k = -r; k <= r; k++) {
        const xx = x + k
        if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++ }
      }
      tmp[y * w + x] = s / n
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0
      for (let k = -r; k <= r; k++) {
        const yy = y + k
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++ }
      }
      out[y * w + x] = s / n
    }
  }
  return out
}

function otsu(values: Float32Array): { threshold: number; contrast: number } {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < values.length; i++) hist[Math.max(0, Math.min(255, Math.round(values[i])))]++
  const total = values.length
  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]
  let wB = 0, sumB = 0, best = -1, threshold = 128, contrast = 0
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sumAll - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) { best = between; threshold = t; contrast = mF - mB }
  }
  return { threshold, contrast }
}

// Separable square max/min filter on a 0/1 mask.
function morph(mask: Uint8Array<ArrayBuffer>, w: number, h: number, r: number, dilate: boolean): Uint8Array<ArrayBuffer> {
  const tmp = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  const hit = dilate ? 1 : 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - hit
      for (let k = -r; k <= r; k++) {
        const xx = Math.max(0, Math.min(w - 1, x + k))
        if (mask[y * w + xx] === hit) { v = hit; break }
      }
      tmp[y * w + x] = v
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - hit
      for (let k = -r; k <= r; k++) {
        const yy = Math.max(0, Math.min(h - 1, y + k))
        if (tmp[yy * w + x] === hit) { v = hit; break }
      }
      out[y * w + x] = v
    }
  }
  return out
}

function largestComponent(mask: Uint8Array, w: number, h: number): { labels: Int32Array; label: number; size: number } {
  const labels = new Int32Array(w * h)
  const stack = new Int32Array(w * h)
  let next = 0, bestLabel = 0, bestSize = 0
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue
    next++
    let top = 0, size = 0
    stack[top++] = start
    labels[start] = next
    while (top > 0) {
      const p = stack[--top]
      size++
      const x = p % w, y = (p - x) / w
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = next; stack[top++] = p - 1 }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = next; stack[top++] = p + 1 }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = next; stack[top++] = p - w }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = next; stack[top++] = p + w }
    }
    if (size > bestSize) { bestSize = size; bestLabel = next }
  }
  return { labels, label: bestLabel, size: bestSize }
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (pts.length < 3) return pts
  const lower: Point[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

export function polygonArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

// Visvalingam: drop the vertex spanning the smallest triangle until ≤ max.
function simplifyHull(hull: Point[], max: number): Point[] {
  const pts = [...hull]
  while (pts.length > max) {
    let minIdx = 0, minArea = Infinity
    for (let i = 0; i < pts.length; i++) {
      const a = Math.abs(cross(pts[(i - 1 + pts.length) % pts.length], pts[i], pts[(i + 1) % pts.length]))
      if (a < minArea) { minArea = a; minIdx = i }
    }
    pts.splice(minIdx, 1)
  }
  return pts
}

function maxAreaQuad(hull: Point[]): Point[] {
  const n = hull.length
  let best: Point[] = hull.slice(0, 4), bestArea = -1
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++) {
          const q = [hull[i], hull[j], hull[k], hull[l]]
          const a = polygonArea(q)
          if (a > bestArea) { bestArea = a; best = q }
        }
  return best
}

/** Orders four convex-polygon corners as TL, TR, BR, BL (y grows downward). */
export function orderQuad(pts: Point[]): Quad {
  // Clockwise on screen (y down) ⇔ positive shoelace sum.
  let s = 0
  for (let i = 0; i < 4; i++) s += pts[i].x * pts[(i + 1) % 4].y - pts[(i + 1) % 4].x * pts[i].y
  const cw = s > 0 ? [...pts] : [...pts].reverse()
  let start = 0
  for (let i = 1; i < 4; i++) if (cw[i].x + cw[i].y < cw[start].x + cw[start].y) start = i
  return [0, 1, 2, 3].map(i => cw[(start + i) % 4]) as Quad
}

function angleDeg(prev: Point, at: Point, next: Point): number {
  const ax = prev.x - at.x, ay = prev.y - at.y, bx = next.x - at.x, by = next.y - at.y
  const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1)
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

/**
 * Finds the page quad on an RGBA image (any size, typically already
 * downscaled). Returns corners in the image's own pixel coordinates, or null
 * when there's no confident page to crop to.
 */
export function detectPageQuad(rgba: Uint8ClampedArray, w: number, h: number): Quad | null {
  const n = w * h
  const whiteness = new Float32Array(n)
  for (let i = 0; i < n; i++) whiteness[i] = Math.min(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])
  const blurred = boxBlur(whiteness, w, h, 2)
  const { threshold, contrast } = otsu(blurred)
  // Paper vs. background must actually differ (white sheet on a white desk → no crop).
  if (contrast < 40) return null

  let mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = blurred[i] > threshold ? 1 : 0
  const r = Math.max(2, Math.round(Math.max(w, h) / 160))
  mask = morph(morph(mask, w, h, r, true), w, h, r, false)

  const { labels, label, size } = largestComponent(mask, w, h)
  if (!label) return null

  // Per-row and per-column extremes of the blob have the same hull as the blob.
  const edge: Point[] = []
  for (let y = 0; y < h; y++) {
    let lo = -1, hi = -1
    for (let x = 0; x < w; x++) if (labels[y * w + x] === label) { if (lo < 0) lo = x; hi = x }
    if (lo >= 0) edge.push({ x: lo, y }, { x: hi + 1, y }, { x: lo, y: y + 1 }, { x: hi + 1, y: y + 1 })
  }
  const hull = convexHull(edge)
  if (hull.length < 4) return null
  const hullArea = polygonArea(hull)
  const quad = orderQuad(maxAreaQuad(simplifyHull(hull, 48)))
  const quadArea = polygonArea(quad)
  const imgArea = w * h

  if (quadArea < imgArea * 0.15) return null          // too small to be "the page on the photo"
  if (quadArea > imgArea * 0.93) return null          // page already fills the frame — nothing to cut
  if (quadArea < hullArea * 0.9) return null          // blob isn't quadrilateral (hand, round object…)
  if (size < hullArea * 0.75) return null             // blob isn't solid (textured/patterned background)
  for (let i = 0; i < 4; i++) {
    const a = angleDeg(quad[(i + 3) % 4], quad[i], quad[(i + 1) % 4])
    if (a < 45 || a > 135) return null
  }
  return quad
}

// ── Perspective warp ─────────────────────────────────────────

/** Solves the 3×3 homography (h33 = 1) mapping each `from[i]` onto `to[i]`. */
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i], { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let c = 0; c < 8; c++) {
    let piv = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    ;[A[c], A[piv]] = [A[piv], A[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]
    }
  }
  return [...A.map((row, i) => row[8] / row[i]), 1]
}

export function outputSize(q: Quad): { width: number; height: number } {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  let width = Math.max(d(q[0], q[1]), d(q[3], q[2]))
  let height = Math.max(d(q[0], q[3]), d(q[1], q[2]))
  const k = Math.min(1, MAX_OUTPUT_SIDE / Math.max(width, height))
  width = Math.max(1, Math.round(width * k))
  height = Math.max(1, Math.round(height * k))
  return { width, height }
}

/** Bilinear inverse-mapping warp of the `quad` region of `src` into a W×H rectangle. */
export function warpQuad(src: Uint8ClampedArray, sw: number, sh: number, quad: Quad, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const H = homography(
    [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }],
    quad,
  )
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const v = y + 0.5
    for (let x = 0; x < width; x++) {
      const u = x + 0.5
      const den = H[6] * u + H[7] * v + H[8]
      let sx = (H[0] * u + H[1] * v + H[2]) / den - 0.5
      let sy = (H[3] * u + H[4] * v + H[5]) / den - 0.5
      sx = Math.max(0, Math.min(sw - 1, sx))
      sy = Math.max(0, Math.min(sh - 1, sy))
      const x0 = Math.floor(sx), y0 = Math.floor(sy)
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1)
      const fx = sx - x0, fy = sy - y0
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4
      const o = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx
        const bot = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx
        out[o + c] = top + (bot - top) * fy
      }
      out[o + 3] = 255
    }
  }
  return out
}

// ── Browser entry point ──────────────────────────────────────

const CROPPABLE = /^image\/(jpeg|png|webp)$/

function drawToImageData(bitmap: ImageBitmap, w: number, h: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(bitmap, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/**
 * If `file` is a photo of a paper page, returns a new JPEG with just the page,
 * straightened. Returns null (keep the original) for non-photos, undecodable
 * formats (e.g. HEIC outside Safari) or when no page is confidently found.
 */
export async function autoCropPagePhoto(file: File): Promise<File | null> {
  if (!CROPPABLE.test(file.type) || typeof createImageBitmap !== 'function') return null
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
  try {
    const { width: bw, height: bh } = bitmap
    const ds = Math.min(1, DETECT_MAX_SIDE / Math.max(bw, bh))
    const dw = Math.max(1, Math.round(bw * ds)), dh = Math.max(1, Math.round(bh * ds))
    const small = drawToImageData(bitmap, dw, dh)
    const quad = detectPageQuad(small.data, dw, dh)
    if (!quad) return null

    const ss = Math.min(1, Math.sqrt(MAX_SOURCE_PIXELS / (bw * bh)))
    const sw = Math.round(bw * ss), sh = Math.round(bh * ss)
    const scale = sw / dw
    // Corners come from a ~480px copy (±1px there ≈ ±8px here) — pull them
    // slightly toward the centre so no sliver of table survives at the edges.
    const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4
    const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4
    const inset = 0.985
    const srcQuad = quad.map(p => ({ x: (cx + (p.x - cx) * inset) * scale, y: (cy + (p.y - cy) * inset) * scale })) as Quad
    const full = drawToImageData(bitmap, sw, sh)
    const { width, height } = outputSize(srcQuad)
    const pixels = warpQuad(full.data, sw, sh, srcQuad, width, height)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.92))
    if (!blob) return null
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
