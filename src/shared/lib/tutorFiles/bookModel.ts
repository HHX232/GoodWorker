import type { BookBookmark, BookPresence, FilesPerson, LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
// Pure book logic (no Prisma/auth, so it self-checks with plain `npx tsx`).
// The server entry point is ./books.ts, which re-exports all of this.

/** Spine-colour presets — the prototype's palette (books-a-showcase.html PRESETS). */
export const SPINE_COLORS = [
  '#2f5aa8', '#c4443e', '#3b3f4a', '#3f7d5b', '#6a4fb3',
  '#c79a2e', '#2a8c8c', '#b9552f', '#b8476b', '#1f3a5f',
] as const

/** Stable colour for a book that has none chosen: 31-hash of the title's UTF-16 units, mod palette size. */
export function defaultSpineColor(title: string): string {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  return SPINE_COLORS[h % SPINE_COLORS.length]
}

const SPINE_COLOR_RE = /^#[0-9a-f]{6}$/i
const COVER_KINDS = ['found', 'page1', 'photo'] as const
export type BookCoverKind = (typeof COVER_KINDS)[number]

export const MAX_BOOK_PAGES = 5000
export const MAX_BOOK_TITLE = 200

/** A 1-based whole page inside the book (`pageCount` unknown → up to MAX_BOOK_PAGES). */
export function isPageInRange(page: unknown, pageCount: number | null): page is number {
  return Number.isInteger(page) && (page as number) >= 1 && (page as number) <= (pageCount ?? MAX_BOOK_PAGES)
}

/** Reading progress in whole percent: lastPage of pageCount, 0 when the count is unknown, never above 100. */
export function bookPct(lastPage: number, pageCount: number | null): number {
  return pageCount ? Math.min(100, Math.round((lastPage / pageCount) * 100)) : 0
}

/**
 * The S3 key of a book cover we uploaded (`tutor-files/<teacher>/covers/<file>`),
 * read off its public URL. Anything else — a foreign host, a book's PDF key — is
 * never ours to delete: null, and logged so a mismatch is not silent.
 */
export function coverKeyOf(coverUrl: string, base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL): string | null {
  const root = base?.replace(/\/$/, '')
  const key = root && coverUrl.startsWith(`${root}/`) ? coverUrl.slice(root.length + 1) : null
  if (key && /^tutor-files\/[^/]+\/covers\/[^/]+$/.test(key)) return key
  console.error('[books] not a cover object of ours, left in place:', coverUrl)
  return null
}

/** `#RRGGBB` (lower-cased) or null — user input never reaches a CSS variable unchecked. */
export function parseSpineColor(v: unknown): string | null {
  return typeof v === 'string' && SPINE_COLOR_RE.test(v) ? v.toLowerCase() : null
}

export function parseCoverKind(v: unknown): BookCoverKind | null {
  return COVER_KINDS.find(k => k === v) ?? null
}

/** Whole page count clamped to 1…MAX_BOOK_PAGES; null when absent or not a number. */
export function clampPageCount(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(MAX_BOOK_PAGES, Math.max(1, Math.round(n))) : null
}

export interface BookRow {
  id: string
  teacherId: string
  name: string
  sizeBytes: number
  createdAt: Date
  bookTitle: string | null
  pageCount: number | null
  coverUrl: string | null
  coverKind: string | null
  spineColor: string | null
}

export function bookTitleOf(f: { name: string; bookTitle: string | null }): string {
  return f.bookTitle?.trim() || f.name.replace(/\.pdf$/i, '')
}

/** TutorFile (isBook) → the client's LibraryBook. Per-viewer parts (saved, progress, sharing) come from the caller. */
export function toBook(
  f: BookRow,
  ctx: { teacherName: string; saved: boolean; progress: { lastPage: number; updatedAt: Date } | null; sharedWith: FilesPerson[] },
): LibraryBook {
  const title = bookTitleOf(f)
  return {
    id: f.id,
    title,
    teacherId: f.teacherId,
    teacherName: ctx.teacherName,
    pageCount: f.pageCount,
    sizeBytes: f.sizeBytes,
    addedAt: f.createdAt.toISOString(),
    cover: {
      kind: f.coverUrl ? parseCoverKind(f.coverKind) : null,
      url: f.coverUrl,
      spineColor: parseSpineColor(f.spineColor) ?? defaultSpineColor(title),
    },
    saved: ctx.saved,
    progress: ctx.progress ? { lastPage: ctx.progress.lastPage, pct: bookPct(ctx.progress.lastPage, f.pageCount), updatedAt: ctx.progress.updatedAt.toISOString() } : null,
    sharedWith: ctx.sharedWith,
  }
}

type PresencePerson = { id: string; name: string; avatarUrl: string | null }

/**
 * The tutor's "who read where" map from raw rows. A page entry exists only if
 * some student stopped on it or read it; students missing from `people`
 * (account gone) are dropped. Both lists newest first.
 */
export function buildPresence(
  stops: { studentId: string; lastPage: number; updatedAt: Date }[],
  reads: { studentId: string; page: number; lastReadAt: Date }[],
  people: Map<string, PresencePerson>,
): BookPresence {
  const pages: BookPresence['pages'] = {}
  const at = (page: number) => (pages[page] ??= { stoppedHere: [], readBy: [] })
  const stoppedOn = new Set<string>()
  for (const s of [...stops].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
    const person = people.get(s.studentId)
    if (!person) continue
    at(s.lastPage).stoppedHere.push({ ...person, stoppedAt: s.updatedAt.toISOString() })
    stoppedOn.add(`${s.studentId}:${s.lastPage}`)
  }
  for (const r of [...reads].sort((a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime())) {
    const person = people.get(r.studentId)
    if (!person || stoppedOn.has(`${r.studentId}:${r.page}`)) continue
    at(r.page).readBy.push({ person, lastReadAt: r.lastReadAt.toISOString() })
  }
  return { pages }
}

export const MAX_BOOKMARK_LABEL = 100

export function toBookmark(b: { id: string; page: number; label: string | null; createdAt: Date }): BookBookmark {
  return { id: b.id, page: b.page, label: b.label, createdAt: b.createdAt.toISOString() }
}
