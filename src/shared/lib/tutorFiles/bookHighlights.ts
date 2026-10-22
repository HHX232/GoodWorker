import { HIGHLIGHT_COLORS } from '@/shared/types/TutorFiles/tutorFiles.types'
import type { BookHighlight, HighlightColor, HighlightRect } from '@/shared/types/TutorFiles/tutorFiles.types'
import { isPageInRange } from './bookModel'
// Pure validation/normalisation for book highlights (no Prisma/auth, so it
// self-checks with plain `npx tsx`). Routes: app/api/tutor-files/books/[id]/highlights.

export const MAX_HIGHLIGHT_TEXT = 2000
export const MAX_HIGHLIGHT_NOTE = 2000
export const MAX_HIGHLIGHT_RECTS = 200
export const MAX_HIGHLIGHTS_PER_BOOK = 500
export const MAX_BODY_BYTES = 256 * 1024

export function isHighlightColor(v: unknown): v is HighlightColor {
  return typeof v === 'string' && (HIGHLIGHT_COLORS as readonly string[]).includes(v)
}

const frac = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

/** 1…200 rects, x/y/w/h numbers in [0,1], w and h > 0. Returns clean copies (extra keys dropped), or null. */
export function parseRects(v: unknown): HighlightRect[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_HIGHLIGHT_RECTS) return null
  const out: HighlightRect[] = []
  for (const r of v) {
    if (!r || typeof r !== 'object') return null
    const { x, y, w, h } = r as Record<string, unknown>
    if (!frac(x) || !frac(y) || !frac(w) || !frac(h) || w <= 0 || h <= 0) return null
    out.push({ x, y, w, h })
  }
  return out
}

/** Comment: string trimmed (blank → null, > 2000 → invalid); null clears; anything else is invalid (undefined). */
export function parseNote(v: unknown): string | null | undefined {
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (t.length > MAX_HIGHLIGHT_NOTE) return undefined
  return t || null
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; error: string }

export interface HighlightInput {
  page: number
  text: string
  rects: HighlightRect[]
  color: HighlightColor
  note: string | null
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Reads a JSON body capped at 256 KB (content-length first, then the real text length). Bad JSON → null body (→ "invalid body"). */
export async function readJsonBody(req: Request): Promise<{ tooLarge: true } | { tooLarge: false; body: unknown }> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return { tooLarge: true }
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) return { tooLarge: true }
  try {
    return { tooLarge: false, body: JSON.parse(text) }
  } catch {
    return { tooLarge: false, body: null }
  }
}

/** POST body → clean input. `pageCount` null = unknown (generic upper bound). */
export function parseHighlightInput(body: unknown, pageCount: number | null): Parsed<HighlightInput> {
  if (!isObject(body)) return { ok: false, error: 'invalid body' }
  const b = body
  if (!isPageInRange(b.page, pageCount)) return { ok: false, error: 'page out of range' }
  const text = typeof b.text === 'string' ? b.text.trim() : ''
  if (!text || text.length > MAX_HIGHLIGHT_TEXT) return { ok: false, error: 'text must be 1..2000 chars' }
  const rects = parseRects(b.rects)
  if (!rects) return { ok: false, error: 'invalid rects' }
  if (b.color !== undefined && !isHighlightColor(b.color)) return { ok: false, error: 'invalid color' }
  const note = b.note === undefined ? null : parseNote(b.note)
  if (note === undefined) return { ok: false, error: 'invalid note' }
  return { ok: true, data: { page: b.page, text, rects, color: (b.color as HighlightColor | undefined) ?? 'yellow', note } }
}

/** PATCH body → only the fields that were sent; at least one is required. */
export function parseHighlightPatch(body: unknown): Parsed<{ note?: string | null; color?: HighlightColor }> {
  if (!isObject(body)) return { ok: false, error: 'invalid body' }
  const b = body
  const data: { note?: string | null; color?: HighlightColor } = {}
  if (b.note !== undefined) {
    const note = parseNote(b.note)
    if (note === undefined) return { ok: false, error: 'invalid note' }
    data.note = note
  }
  if (b.color !== undefined) {
    if (!isHighlightColor(b.color)) return { ok: false, error: 'invalid color' }
    data.color = b.color
  }
  if (!('note' in data) && !('color' in data)) return { ok: false, error: 'note or color required' }
  return { ok: true, data }
}

/** DB row → API shape. `rects` (Json) was validated on write; a stray row without a valid array yields []. */
export function toHighlight(h: { id: string; page: number; text: string; rects: unknown; color: string; note: string | null; createdAt: Date }): BookHighlight {
  const rects = parseRects(h.rects)
  if (!rects) console.warn('[bookHighlights] broken rects, serving []', h.id)
  return {
    id: h.id,
    page: h.page,
    text: h.text,
    rects: rects ?? [],
    color: isHighlightColor(h.color) ? h.color : 'yellow',
    note: h.note,
    createdAt: h.createdAt.toISOString(),
  }
}
