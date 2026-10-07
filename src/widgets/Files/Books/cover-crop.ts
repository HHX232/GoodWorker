// Pure geometry of the 2:3 cover frame (no DOM — self-checked with plain `npx tsx`).

export const COVER_W = 2
export const COVER_H = 3
export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

export interface CropRect { sx: number; sy: number; sw: number; sh: number }

/**
 * The part of an `iw`×`ih` image that lands in an `outW`×`outH` frame.
 * zoom 1 = the image just covers the frame (never a blank edge); `x`/`y` in
 * -100…100 slide the image toward that edge: ±100 pushes it as far as it can
 * go (the opposite edge of the image reaches the frame edge), 0 = centred.
 * Returns the source rectangle to feed `drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)`.
 */
export function cropRect(iw: number, ih: number, outW: number, outH: number, zoom: number, x: number, y: number): CropRect {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  const s = Math.max(outW / iw, outH / ih) * z
  const sw = outW / s
  const sh = outH / s
  const shiftX = (Math.min(100, Math.max(-100, x)) / 100) * ((iw * s - outW) / 2)
  const shiftY = (Math.min(100, Math.max(-100, y)) / 100) * ((ih * s - outH) / 2)
  return { sx: (iw - sw) / 2 - shiftX / s, sy: (ih - sh) / 2 - shiftY / s, sw, sh }
}
