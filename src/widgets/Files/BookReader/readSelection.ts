// Reads the user's text selection out of the reader's pdf.js text layers: which
// page it belongs to, its quote and its rects as fractions of that page.
// One page only: a selection spanning a spread keeps the part on the page where it began.
import type { HighlightRect } from '@/shared/types/TutorFiles/tutorFiles.types'
import { clipQuote, rectsToFractions, type Anchor } from './highlightGeometry'

export interface ReadSelection {
  page: number
  text: string
  /** The selection exactly as the user made it (line breaks kept, not cut) — what «Копировать» puts on the clipboard. */
  copyText: string
  rects: HighlightRect[]
  /** Viewport box to hang the mini-bar on: first line's left/top … last line's bottom. */
  anchor: Anchor
}

const layerOf = (node: Node | null): HTMLElement | null =>
  (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>('[data-text-layer]') ?? null

export function readSelection(stage: HTMLElement): ReadSelection | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!stage.contains(range.commonAncestorContainer)) return null

  const layers = Array.from(stage.querySelectorAll<HTMLElement>('[data-text-layer]'))
  const layer = layerOf(sel.anchorNode) ?? layerOf(sel.focusNode) ?? layers.find(l => range.intersectsNode(l)) ?? null
  const page = Number(layer?.dataset.textLayer)
  if (!layer || !layer.firstChild || !Number.isInteger(page)) return null

  // Clip the range to this page's text layer.
  const clip = range.cloneRange()
  let clipped = false
  if (!layer.contains(range.startContainer)) { clip.setStartBefore(layer.firstChild); clipped = true }
  if (!layer.contains(range.endContainer)) { clip.setEndAfter(layer.lastChild as Node); clipped = true }

  const copyText = clipped ? clip.toString() : sel.toString()
  const text = clipQuote(copyText)
  if (!text) return null
  const box = layer.getBoundingClientRect()
  const raw = Array.from(clip.getClientRects()).filter(r => r.width > 0 && r.height > 0)
  const rects = rectsToFractions(raw, box)
  if (rects.length === 0) return null

  const first = raw.reduce((a, r) => (r.top < a.top - 1 || (Math.abs(r.top - a.top) <= 1 && r.left < a.left) ? r : a))
  const bottom = Math.max(...raw.map(r => r.bottom))
  return { page, text, copyText, rects, anchor: { left: first.left, top: first.top, bottom, width: first.width } }
}
