'use client'

import type { BookBookmark, BookPresence, LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesApiError, filesFetch, jsonInit } from '../lib'
import { BookReaderCore } from './BookReaderCore'
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
      onForbidden={close}
    />
  )
}
