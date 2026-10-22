// Canvas side of the cover: draw a 2:3 crop of an image, JPEG out. Geometry lives in cover-crop.ts.
import { COVER_H, COVER_W, cropRect } from './cover-crop'

export interface CoverSource { source: CanvasImageSource; width: number; height: number }
export interface CoverCrop { zoom: number; x: number; y: number }

export const CENTERED: CoverCrop = { zoom: 1, x: 0, y: 0 }

function draw(src: CoverSource, crop: CoverCrop, outW: number): HTMLCanvasElement {
  const outH = Math.round((outW * COVER_H) / COVER_W)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.fillStyle = '#ffffff' // transparent PNGs become JPEG — no black halo
  ctx.fillRect(0, 0, outW, outH)
  const r = cropRect(src.width, src.height, outW, outH, crop.zoom, crop.x, crop.y)
  ctx.drawImage(src.source, r.sx, r.sy, r.sw, r.sh, 0, 0, outW, outH)
  return canvas
}

/** Sync, small — the live preview while a slider moves. */
export function coverDataUrl(src: CoverSource, crop: CoverCrop, outW = 300): string {
  return draw(src, crop, outW).toDataURL('image/jpeg', 0.85)
}

/** The file that is uploaded as `cover` (JPEG, 2:3). */
export function coverBlob(src: CoverSource, crop: CoverCrop, outW = 800): Promise<Blob> {
  return canvasBlob(draw(src, crop, outW), 0.9)
}

export function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality))
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error ?? new Error('read failed'))
    fr.readAsDataURL(blob)
  })
}

/** Decodes a picked picture; rejects when the browser cannot show it (HEIC etc.). */
export function loadImage(file: Blob): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // A 0×0 picture (broken SVG, odd decoder) would turn the crop maths into NaN/Infinity.
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('empty image'))
      else resolve({ img, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}
