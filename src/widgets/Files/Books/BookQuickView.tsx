'use client'

import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { FilesDeleteIcon, FilesDownloadIcon, FilesCoverIcon, FilesPlayIcon, FilesShareIcon } from '../icons'
import { formatBytes, formatDate, triggerDownload } from '../lib'
import ui from '../ui.module.scss'
import { BookCover } from './BookCover'
import { bookContentUrl, deleteBook, setBookSaved, updateBook } from './bookFetch'
import { BookModal } from './BookModal'
import { CoverEditor, type CoverValue } from './CoverEditor'
import { renderPdfFirstPage } from './renderPdfFirstPage'
import { blobToDataUrl } from './coverCanvas'
import styles from './BookQuickView.module.scss'

export interface BookQuickViewProps {
  book: LibraryBook
  /** The tutor who owns the book: cover editing, sharing, deleting. */
  canManage: boolean
  onClose: () => void
  /** The book changed (save toggled, cover edited → the updated book) or was deleted (null). Refetch / patch your list. */
  onChanged: (book: LibraryBook | null) => void
  /** Owner only: open the share dialog (ShareAccessModal) for this book. */
  onShare?: (book: LibraryBook) => void
}

type Mode = 'view' | 'cover' | 'delete'

const COVER_NAME = { found: 'booksKitCoverFound', page1: 'booksKitCoverPage1', photo: 'booksKitCoverPhoto' } as const

/** Quick look at a book: big 3D cover, meta, reading progress, Read / Save / Download, and for the owner Cover / Share / Delete. */
export function BookQuickView({ book, canManage, onClose, onChanged, onShare }: BookQuickViewProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const [current, setCurrent] = useState(book)
  const [seen, setSeen] = useState(book)
  if (seen !== book) { setSeen(book); setCurrent(book) } // the parent sent a fresher book
  const [mode, setMode] = useState<Mode>('view')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<CoverValue | null>(null)

  const pct = current.progress?.pct ?? 0
  const meta = current.pageCount ? t('booksKitMeta', { teacher: current.teacherName, pages: current.pageCount }) : current.teacherName

  const toggleSave = async () => {
    if (busy) return
    const next = !current.saved
    setCurrent({ ...current, saved: next })
    setBusy(true)
    try {
      await setBookSaved(current.id, next)
      onChanged({ ...current, saved: next })
    } catch {
      setCurrent(current)
      toast.error(t('errGeneric'))
    } finally {
      setBusy(false)
    }
  }

  const openCover = () => {
    setDraft({ spineColor: current.cover.spineColor, image: current.cover.url ? { kind: current.cover.kind ?? 'photo', previewUrl: current.cover.url, getBlob: null } : null })
    setMode('cover')
  }

  // Page 1 of the book itself: the PDF is fetched through the content route (same access as reading) and rendered here.
  const loadPage1 = async () => {
    const res = await fetch(bookContentUrl(current.id))
    if (!res.ok) throw new Error('content')
    const { cover } = await renderPdfFirstPage(await res.arrayBuffer())
    return { blob: cover, previewUrl: await blobToDataUrl(cover) }
  }

  const applyCover = async () => {
    if (!draft || busy) return
    setBusy(true)
    try {
      const had = !!current.cover.url
      const img = draft.image
      const blob = img?.getBlob ? await img.getBlob() : null
      const colorChanged = draft.spineColor.toLowerCase() !== current.cover.spineColor.toLowerCase()
      const removing = !img && had
      if (!blob && !colorChanged && !removing) { setMode('view'); return } // nothing changed
      const updated = await updateBook(current.id, {
        ...(colorChanged ? { spineColor: draft.spineColor } : {}),
        ...(img && blob ? { cover: { blob, kind: img.kind } } : {}),
        ...(removing ? { resetCover: true } : {}),
      })
      setCurrent(updated)
      onChanged(updated)
      setMode('view')
    } catch {
      toast.error(t('errGeneric'))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (busy) return
    setBusy(true)
    try {
      await deleteBook(current.id)
      onChanged(null)
      onClose()
    } catch {
      toast.error(t('errGeneric'))
      setBusy(false)
    }
  }

  if (mode === 'cover' && draft) {
    return (
      <BookModal
        title={t('booksKitCoverModalTitle', { title: current.title })}
        closeLabel={t('close')}
        onClose={() => setMode('view')}
        locked={busy}
        footer={
          <>
            <button type="button" className={ui.btn} onClick={() => setMode('view')} disabled={busy}>{t('cancel')}</button>
            <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={applyCover} disabled={busy} data-autofocus>{busy ? t('booksKitSaving') : t('booksKitApply')}</button>
          </>
        }
      >
        <CoverEditor title={current.title} value={draft} onChange={setDraft} loadPage1={loadPage1} />
      </BookModal>
    )
  }

  if (mode === 'delete') {
    return (
      <BookModal
        title={t('deleteTitle')}
        closeLabel={t('close')}
        onClose={() => setMode('view')}
        locked={busy}
        footer={
          <>
            <button type="button" className={ui.btn} onClick={() => setMode('view')} disabled={busy} data-autofocus>{t('cancel')}</button>
            <button type="button" className={`${ui.btn} ${ui.danger}`} onClick={confirmDelete} disabled={busy}>{t('delete')}</button>
          </>
        }
      >
        <p className={styles.confirm}>{t('booksKitDeleteConfirm', { title: current.title })}</p>
      </BookModal>
    )
  }

  const coverName = current.cover.url ? t(COVER_NAME[current.cover.kind ?? 'photo']) : t('booksKitCoverGenerated')

  return (
    <BookModal title={t('booksKitQuickTitle')} closeLabel={t('close')} onClose={onClose}>
      <div className={styles.qv}>
        <div className={styles.art}>
          <BookCover title={current.title} spineColor={current.cover.spineColor} coverUrl={current.cover.url} coverKind={current.cover.kind} size="xl" progressPct={pct} />
        </div>
        <div className={styles.info}>
          <h3 className={styles.name}>{current.title}</h3>
          <p className={styles.by}>{meta}</p>
          <dl className={styles.dl}>
            <dt>{t('booksKitFormat')}</dt><dd>PDF</dd>
            <dt>{t('booksKitSize')}</dt><dd>{formatBytes(current.sizeBytes, locale)}</dd>
            {current.pageCount ? <><dt>{t('booksKitPagesLabel')}</dt><dd>{current.pageCount}</dd></> : null}
            <dt>{t('booksKitAdded')}</dt><dd>{formatDate(current.addedAt, locale)}</dd>
            <dt>{t('booksKitCoverLabel')}</dt><dd>{coverName}</dd>
          </dl>
          <div className={styles.prog}>
            {current.progress ? (
              <>
                <div className={styles.row}>
                  <span>{pct >= 100 ? t('booksKitProgressDoneLabel') : t('booksKitProgressLabel')}{current.pageCount ? ` · ${t('booksKitProgressPage', { page: current.progress.lastPage, pages: current.pageCount })}` : ''}</span>
                  <b>{pct}%</b>
                </div>
                <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('booksKitProgressAria')}><i style={{ width: `${pct}%` }} /></div>
              </>
            ) : (
              <div className={styles.row}><span>{t('booksKitNeverOpened')}</span></div>
            )}
          </div>
          <div className={styles.acts}>
            <Link href={`/files/books/${current.id}`} className={`${ui.btn} ${ui.primary}`} data-autofocus><FilesPlayIcon size={16} />{t('booksKitRead')}</Link>
            <button type="button" className={ui.btn} aria-pressed={current.saved} onClick={toggleSave} disabled={busy}>{current.saved ? t('booksKitUnsave') : t('booksKitSave')}</button>
            <button type="button" className={ui.btn} onClick={() => triggerDownload({ url: bookContentUrl(current.id), name: `${current.title}.pdf` })}><FilesDownloadIcon size={16} />{t('download')}</button>
            {canManage && (
              <>
                <button type="button" className={ui.btn} onClick={openCover}><FilesCoverIcon size={16} />{t('booksKitChangeCover')}</button>
                {onShare && <button type="button" className={ui.btn} onClick={() => onShare(current)}><FilesShareIcon size={16} />{t('booksKitShare')}</button>}
                <button type="button" className={ui.btn} onClick={() => setMode('delete')}><FilesDeleteIcon size={16} />{t('delete')}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </BookModal>
  )
}
