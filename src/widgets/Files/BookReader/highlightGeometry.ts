// Pure geometry of text highlights: DOM rects → fractions of the page (0..1),
// joining the rects of one line, hit-testing a click, placing a floating box on
// screen, quote helpers. No DOM here, so it self-checks with plain `npx tsx`.
import type { HighlightRect } from '@/shared/types/TutorFiles/tutorFiles.types'

/** A DOMRect-like box in px. */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** Server cap (MAX_HIGHLIGHT_TEXT / MAX_HIGHLIGHT_RECTS in bookHighlights.ts). */
export const MAX_QUOTE = 2000
export const MAX_RECTS = 200
/** Two rects of one line join when the gap between them is ≤ this share of the page width. */
const JOIN_GAP = 0.006
/** Two rects are one line when they overlap vertically by ≥ this share of the lower one. */
const SAME_LINE = 0.6
/** Smaller than this (share of the page) is a rounding artefact, not text. */
const MIN_SIDE = 0.0005

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const round4 = (v: number) => Math.round(v * 10000) / 10000

/**
 * Client rects of a selection → rects as fractions of the page box. Rects whose
 * centre lies outside the page (the other page of a spread) are dropped; the rest
 * is clamped to [0,1], rounded to 4 digits, and the rects of one line are joined.
 */
export function rectsToFractions(rects: readonly Box[], page: Box): HighlightRect[] {
  if (page.width <= 0 || page.height <= 0) return []
  const out: HighlightRect[] = []
  for (const r of rects) {
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    if (cx < page.left || cx > page.left + page.width || cy < page.top || cy > page.top + page.height) continue
    const x = clamp01((r.left - page.left) / page.width)
    const y = clamp01((r.top - page.top) / page.height)
    const right = clamp01((r.left + r.width - page.left) / page.width)
    const bottom = clamp01((r.top + r.height - page.top) / page.height)
    if (right - x < MIN_SIDE || bottom - y < MIN_SIDE) continue
    out.push({ x, y, w: right - x, h: bottom - y })
  }
  return mergeLineRects(out).slice(0, MAX_RECTS)
}

/** Joins rects of one line that touch or overlap (also drops a span box lying inside its text rect); result is in reading order. */
export function mergeLineRects(rects: readonly HighlightRect[]): HighlightRect[] {
  const sorted = [...rects].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x)
  const lines: HighlightRect[][] = []
  for (const r of sorted) {
    const line = lines.find(l => {
      const top = Math.min(...l.map(q => q.y))
      const bottom = Math.max(...l.map(q => q.y + q.h))
      const overlap = Math.min(bottom, r.y + r.h) - Math.max(top, r.y)
      return overlap >= SAME_LINE * Math.min(bottom - top, r.h)
    })
    if (line) line.push(r)
    else lines.push([r])
  }
  const out: HighlightRect[] = []
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x)
    let cur = { left: line[0].x, right: line[0].x + line[0].w, top: line[0].y, bottom: line[0].y + line[0].h }
    const flush = () => out.push({
      x: round4(cur.left),
      y: round4(cur.top),
      w: round4(round4(cur.right) - round4(cur.left)),
      h: round4(round4(cur.bottom) - round4(cur.top)),
    })
    for (const r of line.slice(1)) {
      if (r.x <= cur.right + JOIN_GAP) {
        cur = { left: cur.left, right: Math.max(cur.right, r.x + r.w), top: Math.min(cur.top, r.y), bottom: Math.max(cur.bottom, r.y + r.h) }
      } else {
        flush()
        cur = { left: r.x, right: r.x + r.w, top: r.y, bottom: r.y + r.h }
      }
    }
    flush()
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x)
}

/** The highlight under a point (fractions of the page); on overlap the later one in the list wins. `pad` widens every rect a little (finger-sized). */
export function hitHighlight<T extends { rects: readonly HighlightRect[] }>(list: readonly T[], x: number, y: number, pad = 0.002): T | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].rects.some(r => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad)) return list[i]
  }
  return null
}

export interface Anchor {
  left: number
  top: number
  bottom: number
  width: number
}
export interface Placement {
  left: number
  /** Set when the box opens downwards (top-anchored). */
  top?: number
  /** Set when it opens upwards (bottom-anchored, so its own height does not matter). */
  bottom?: number
  maxHeight: number
  side: 'above' | 'below'
}

/**
 * Where a floating box of `width` goes relative to an anchor, inside the viewport:
 * horizontally centred on the anchor but kept `margin` from both edges; on the
 * preferred side unless it has less than `need` px of room there and the other side has more.
 */
export function placeFloating(a: { anchor: Anchor; width: number; viewport: { w: number; h: number }; prefer: 'above' | 'below'; need: number; gap?: number; margin?: number }): Placement {
  const gap = a.gap ?? 8
  const margin = a.margin ?? 8
  const left = Math.max(margin, Math.min(a.anchor.left + a.anchor.width / 2 - a.width / 2, a.viewport.w - a.width - margin))
  const above = a.anchor.top - gap - margin
  const below = a.viewport.h - a.anchor.bottom - gap - margin
  const other = a.prefer === 'above' ? 'below' : 'above'
  const room = { above, below }
  const side = room[a.prefer] >= a.need || room[a.prefer] >= room[other] ? a.prefer : other
  return side === 'below'
    ? { left, top: a.anchor.bottom + gap, maxHeight: Math.max(0, below), side }
    : { left, bottom: a.viewport.h - a.anchor.top + gap, maxHeight: Math.max(0, above), side }
}

/** Selection text → a one-line quote: whitespace collapsed, cut to `max` UTF-16 units without splitting a surrogate pair. */
export function clipQuote(text: string, max = MAX_QUOTE): string {
  let s = text.replace(/\s+/g, ' ').trim()
  if (s.length > max) {
    s = s.slice(0, max)
    const last = s.charCodeAt(s.length - 1)
    if (last >= 0xd800 && last <= 0xdbff) s = s.slice(0, -1)
    s = s.trimEnd()
  }
  return s
}

/** Short preview for the list: cut at a word boundary when one is near the end, with an ellipsis. */
export function excerpt(text: string, max = 160): string {
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const sp = head.lastIndexOf(' ')
  return `${(sp > max * 0.6 ? head.slice(0, sp) : head).trimEnd()}…`
}
