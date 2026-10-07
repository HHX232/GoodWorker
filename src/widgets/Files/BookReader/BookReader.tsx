'use client'

import type { BookBookmark, BookHighlight, BookPresence, HighlightColor, LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FilesApiError, filesFetch, jsonInit } from '../lib'
import { BookReaderCore, type NewHighlight } from './BookReaderCore'
import styles from './BookReader.module.scss'

const PRESENCE_POLL_MS = 20_000
const LIBRARY_HREF = '/files'

type Phase = { kind: 'loading' } | { kind: 'closed' } | { kind: 'error' } | { kind: 'ready'; book: LibraryBook }

function StateScreen({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{title}</h1>
        {text && <p className={styles.stateText}>{text}</p>}
        {children && <div className={styles.stateActions}>{children}</div>}
      </div>
    </div>
  )
}

/** `/files/books/[id]` — fetches the book, the viewer's bookmarks and (tutor) reader presence, and feeds the pure reader. */
export function BookReader({ bookId, role }: { bookId: string; role: 'teacher' | 'student' }) {
  const t = useTranslations('files')
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [bookmarks, setBookmarks] = useState<BookBookmark[]>([])
  const [presence, setPresence] = useState<BookPresence | null>(null)
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  // Highlights deleted here: a slow GET /highlights must not bring them back. patchSeq: the latest PATCH per (highlight, field) owns that field.
  const deletedHl = useRef(new Set<string>())
  const patchSeq = useRef(new Map<string, number>())
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t })
  const lastSent = useRef<number | null>(null)
  const base = `/api/tutor-files/books/${encodeURIComponent(bookId)}`

  const close = useCallback(() => setPhase({ kind: 'closed' }), [])
  // 403 anywhere = the grant is gone; anything else is a transient failure the caller handles.
  const guard = useCallback((e: unknown) => {
    if (e instanceof FilesApiError && (e.status === 403 || e.status === 401)) close()
  }, [close])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { books } = await filesFetch<{ books: LibraryBook[] }>('/api/tutor-files/books')
        const book = books.find(b => b.id === bookId)
        if (cancelled) return
        if (!book) { setPhase({ kind: 'closed' }); return }
        const { bookmarks: marks } = await filesFetch<{ bookmarks: BookBookmark[] }>(`${base}/bookmarks`)
        if (cancelled) return
        lastSent.current = book.progress?.lastPage ?? null
        setBookmarks(marks)
        setPhase({ kind: 'ready', book })
      } catch (e) {
        if (cancelled) return
        setPhase(e instanceof FilesApiError && (e.status === 403 || e.status === 401) ? { kind: 'closed' } : { kind: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [bookId, base])

  const ready = phase.kind === 'ready'
  useEffect(() => {
    if (!ready || role !== 'teacher') return
    let cancelled = false
    const pull = () => {
      if (document.visibilityState !== 'visible') return
      filesFetch<BookPresence>(`${base}/presence`).then(p => { if (!cancelled) setPresence(p) }).catch(guard) // 401/403 = access gone; other errors: marks just don't refresh
    }
    pull()
    const id = setInterval(pull, PRESENCE_POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [ready, role, base, guard])

  // The viewer's highlights load apart from the book: if they fail the book still reads, just without fills.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    filesFetch<{ highlights: BookHighlight[] }>(`${base}/highlights`)
      .then(r => {
        if (cancelled) return
        // Merge by id: what this session already saved (POST answered before this slow GET) is not lost, and local state wins for shared ids.
        setHighlights(cur => {
          const server = r.highlights.filter(h => !deletedHl.current.has(h.id))
          const local = new Map(cur.map(h => [h.id, h]))
          const known = new Set(server.map(h => h.id))
          return [...server.map(h => local.get(h.id) ?? h), ...cur.filter(h => !known.has(h.id))]
        })
      })
      .catch(e => {
        if (cancelled) return
        if (e instanceof FilesApiError && (e.status === 403 || e.status === 401)) close()
        else toast.error(tRef.current('booksHlLoadFailed'))
      })
    return () => { cancelled = true }
  }, [ready, base, close])

  // Only a *changed* page is sent: re-sending the same one would move "stopped at" (updatedAt) for nothing.
  const onPageSettled = useCallback((page: number, spread: number[]) => {
    const last = lastSent.current
    if (page === last || (last !== null && spread.includes(last))) return
    const prev = lastSent.current
    lastSent.current = page
    filesFetch(`${base}/progress`, jsonInit('POST', { page })).catch(e => { lastSent.current = prev; guard(e) })
  }, [base, guard])

  const reloadBookmarks = useCallback(() => {
    filesFetch<{ bookmarks: BookBookmark[] }>(`${base}/bookmarks`).then(r => setBookmarks(r.bookmarks)).catch(guard)
  }, [base, guard])

  const onToggleBookmark = useCallback((page: number) => {
    const existing = bookmarks.find(b => b.page === page)
    if (existing) {
      setBookmarks(list => list.filter(b => b.id !== existing.id))
      filesFetch(`${base}/bookmarks/${existing.id}`, { method: 'DELETE' }).catch(e => { guard(e); reloadBookmarks() })
    } else {
      filesFetch<{ bookmark: BookBookmark }>(`${base}/bookmarks`, jsonInit('POST', { page }))
        .then(r => setBookmarks(list => [...list.filter(b => b.page !== page), r.bookmark].sort((a, b) => a.page - b.page)))
        .catch(guard)
    }
  }, [bookmarks, base, guard, reloadBookmarks])

  const onRenameBookmark = useCallback((id: string, label: string) => {
    const text = label.trim()
    setBookmarks(list => list.map(b => (b.id === id ? { ...b, label: text || null } : b)))
    filesFetch(`${base}/bookmarks/${id}`, jsonInit('PATCH', { label: text })).catch(e => { guard(e); reloadBookmarks() })
  }, [base, guard, reloadBookmarks])

  const onRemoveBookmark = useCallback((id: string) => {
    setBookmarks(list => list.filter(b => b.id !== id))
    filesFetch(`${base}/bookmarks/${id}`, { method: 'DELETE' }).catch(e => { guard(e); reloadBookmarks() })
  }, [base, guard, reloadBookmarks])

  /** 403/401 = access gone (closed screen); 409/413 have their own wording, everything else the fallback. */
  const failHighlight = (e: unknown, fallbackKey: 'booksHlSaveFailed' | 'booksHlUpdateFailed' | 'booksHlDeleteFailed') => {
    if (e instanceof FilesApiError && (e.status === 403 || e.status === 401)) { close(); return }
    const status = e instanceof FilesApiError ? e.status : 0
    toast.error(t(status === 409 ? 'booksHlLimit' : status === 413 ? 'booksHlTooBig' : fallbackKey))
  }

  // Not drawn until the server answers: a failed save leaves no ghost fill. The POST is idempotent, so a retry can't double it.
  const onCreateHighlight = async (input: NewHighlight): Promise<BookHighlight | null> => {
    try {
      const { highlight } = await filesFetch<{ highlight: BookHighlight }>(`${base}/highlights`, jsonInit('POST', input))
      setHighlights(list => (list.some(h => h.id === highlight.id) ? list : [...list, highlight]))
      return highlight
    } catch (e) {
      failHighlight(e, 'booksHlSaveFailed')
      return null
    }
  }

  const onUpdateHighlight = (id: string, patch: { note?: string | null; color?: HighlightColor }) => {
    const before = highlights.find(h => h.id === id)
    if (!before) return
    // Only this patch's own fields are touched, and only while it is still the latest PATCH of that field:
    // a later PATCH (or its optimistic value) is never overwritten by this one's answer or rollback.
    const keys = Object.keys(patch) as ('note' | 'color')[]
    const mine = new Map(keys.map(k => {
      const n = (patchSeq.current.get(`${id}:${k}`) ?? 0) + 1
      patchSeq.current.set(`${id}:${k}`, n)
      return [k, n] as const
    }))
    const settle = (from: BookHighlight) => setHighlights(list => list.map(h => {
      if (h.id !== id) return h
      let next = h
      for (const k of keys) if (patchSeq.current.get(`${id}:${k}`) === mine.get(k)) next = { ...next, [k]: from[k] }
      return next
    }))
    setHighlights(list => list.map(h => (h.id === id ? { ...h, ...patch } : h)))
    filesFetch<{ highlight: BookHighlight }>(`${base}/highlights/${id}`, jsonInit('PATCH', patch))
      .then(r => settle(r.highlight))
      .catch(e => {
        settle(before)
        failHighlight(e, 'booksHlUpdateFailed')
      })
  }

  const onRemoveHighlight = (id: string) => {
    const before = highlights.find(h => h.id === id)
    if (!before) return
    deletedHl.current.add(id)
    setHighlights(list => list.filter(h => h.id !== id))
    filesFetch(`${base}/highlights/${id}`, { method: 'DELETE' }).catch(e => {
      if (e instanceof FilesApiError && e.status === 404) return // already gone on the server — nothing to restore
      deletedHl.current.delete(id)
      setHighlights(list => (list.some(h => h.id === id) ? list : [...list, before].sort((a, b) => a.page - b.page)))
      failHighlight(e, 'booksHlDeleteFailed')
    })
  }

  if (phase.kind === 'loading') return <div className={styles.root}><div className={styles.loading}><span className={styles.spinner} /><span>{t('booksReaderLoading')}</span></div></div>
  if (phase.kind === 'closed') {
    return (
      <StateScreen title={t('booksReaderClosedTitle')} text={t('booksReaderClosedText')}>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href={LIBRARY_HREF}>{t('booksReaderToLibrary')}</Link>
      </StateScreen>
    )
  }
  if (phase.kind === 'error') {
    return (
      <StateScreen title={t('booksReaderErrorTitle')} text={t('booksReaderOpenFailed')}>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href={LIBRARY_HREF}>{t('booksReaderToLibrary')}</Link>
      </StateScreen>
    )
  }

  const { book } = phase
  return (
    <BookReaderCore
      contentUrl={`/api/tutor-files/files/${encodeURIComponent(book.id)}/content`}
      title={book.title}
      backHref={LIBRARY_HREF}
      initialPage={book.progress?.lastPage ?? 1}
      hasProgress={!!book.progress}
      bookmarks={bookmarks}
      presence={role === 'teacher' ? presence : null}
      onPageSettled={onPageSettled}
      onToggleBookmark={onToggleBookmark}
      onRenameBookmark={onRenameBookmark}
      onRemoveBookmark={onRemoveBookmark}
      highlights={highlights}
      onCreateHighlight={onCreateHighlight}
      onUpdateHighlight={onUpdateHighlight}
      onRemoveHighlight={onRemoveHighlight}
      onForbidden={close}
    />
  )
}
