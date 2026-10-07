// Pure logic of the "All books" page: tabs, search, sorting, "Continue reading". No React, no fetch.
import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'

/** The three tabs plus the hero's mini-collections and the carousel's "recently opened". */
export type BookFilter = 'all' | 'saved' | 'new' | 'opened' | 'withcover' | 'needcover' | 'done'
export type BookSort = 'recent' | 'title' | 'progress'

/** "New" = the N most recently added books (the design's "Новые" shelf is a short list, not an age window). */
export const NEW_COUNT = 6
export const HERO_STACK = 5

const openedAt = (b: LibraryBook) => (b.progress ? Date.parse(b.progress.updatedAt) : null)
export const isDone = (b: LibraryBook) => (b.progress?.pct ?? 0) >= 100
const byTitle = (a: LibraryBook, b: LibraryBook, locale?: string) => a.title.localeCompare(b.title, locale)

export function newestIds(books: LibraryBook[]): Set<string> {
  return new Set(
    [...books].sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt) || a.id.localeCompare(b.id)).slice(0, NEW_COUNT).map(b => b.id),
  )
}

/** The "new" shelf, newest first (the carousel's order). */
export function newBooks(books: LibraryBook[]): LibraryBook[] {
  const fresh = newestIds(books)
  return books.filter(b => fresh.has(b.id)).sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt) || a.id.localeCompare(b.id))
}

export function filterBooks(books: LibraryBook[], filter: BookFilter, query: string): LibraryBook[] {
  const q = query.trim().toLowerCase()
  const fresh = filter === 'new' ? newestIds(books) : null
  const pass = (b: LibraryBook) => {
    switch (filter) {
      case 'saved': return b.saved
      case 'new': return fresh!.has(b.id)
      case 'opened': return b.progress !== null
      case 'withcover': return !!b.cover.url
      case 'needcover': return !b.cover.url
      case 'done': return isDone(b)
      default: return true
    }
  }
  return books.filter(b => pass(b) && (!q || b.title.toLowerCase().includes(q)))
}

export function sortBooks(books: LibraryBook[], mode: BookSort, locale?: string): LibraryBook[] {
  const l = [...books]
  if (mode === 'title') return l.sort((a, b) => byTitle(a, b, locale))
  if (mode === 'progress') return l.sort((a, b) => (b.progress?.pct ?? -1) - (a.progress?.pct ?? -1) || byTitle(a, b, locale))
  const key = (b: LibraryBook) => openedAt(b) ?? Date.parse(b.addedAt)
  return l.sort((a, b) => key(b) - key(a) || byTitle(a, b, locale))
}

/** Opened books, the freshest first — the carousel's "Недавно открывали". */
export function recentlyOpened(books: LibraryBook[]): LibraryBook[] {
  return books.filter(b => b.progress).sort((a, b) => openedAt(b)! - openedAt(a)!)
}

/** Hero: the unfinished book with the freshest progress (a finished book has nothing to continue). */
export function continueBook(books: LibraryBook[]): LibraryBook | null {
  return recentlyOpened(books).find(b => !isDone(b)) ?? null
}

export function bookCounts(books: LibraryBook[]) {
  return { total: books.length, saved: books.filter(b => b.saved).length, fresh: Math.min(NEW_COUNT, books.length) }
}
