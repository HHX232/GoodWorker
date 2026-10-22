'use client'

import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import { BookCover } from './BookCover'
import styles from './BookCard.module.scss'

export interface BookCardProps {
  book: LibraryBook
  /** md — cover ≈ 150px (the /files shelf), lg ≈ 200px. */
  size?: 'md' | 'lg'
  /** Click anywhere on the card (the ribbon excepted). */
  onOpen: (book: LibraryBook) => void
  onToggleSave: (book: LibraryBook) => void
  /** "Мои книги": a reading-progress bar under the meta line. */
  showProgress?: boolean
}

/** A book on the shelf: the 3D cover with its ribbon, the title and "tutor · N pages". */
export function BookCard({ book, size = 'md', onOpen, onToggleSave, showProgress = false }: BookCardProps) {
  const t = useTranslations('files')
  const pct = book.progress?.pct ?? 0
  const done = pct >= 100
  const meta = book.pageCount ? t('booksKitMeta', { teacher: book.teacherName, pages: book.pageCount }) : book.teacherName

  return (
    <article className={`${styles.card} ${styles[size]}`}>
      <button type="button" className={styles.hit} onClick={() => onOpen(book)} aria-label={t('booksKitOpenAria', { title: book.title })} />
      <BookCover
        className={styles.book}
        title={book.title}
        spineColor={book.cover.spineColor}
        coverUrl={book.cover.url}
        coverKind={book.cover.kind}
        size="fluid"
        saved={book.saved}
        onToggleSave={() => onToggleSave(book)}
      />
      <h3 className={styles.title} title={book.title}>{book.title}</h3>
      <p className={styles.meta}>{meta}</p>
      {showProgress && (
        <div className={styles.prog}>
          {book.progress ? (
            <>
              <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('booksKitProgressAria')}><i style={{ width: `${pct}%` }} /></div>
              <b className={done ? styles.done : undefined}>{done ? t('booksKitProgressDone') : `${pct}%`}</b>
            </>
          ) : (
            <span>{t('booksKitNotOpened')}</span>
          )}
        </div>
      )}
    </article>
  )
}
