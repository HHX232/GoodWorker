'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from './BookmarksModal.module.scss'

interface Bookmark {
  id: string
  sourceType: string
  sourceId: string
  text: string
  contextText: string
  offset: number
  length: number
  createdAt: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

function sourceHref(b: Bookmark) {
  if (b.sourceType === 'post') return `/post/${b.sourceId}`
  if (b.sourceType === 'roadmap') return `/workflows-list/${b.sourceId}`
  return '#'
}

function sourceLabel(sourceType: string) {
  if (sourceType === 'post') return 'Пост'
  if (sourceType === 'roadmap') return 'Курс'
  return sourceType
}

function ContextView({ bookmark }: { bookmark: Bookmark }) {
  const { contextText, offset, length } = bookmark
  const before = contextText.slice(Math.max(0, offset - 400), offset)
  const highlighted = contextText.slice(offset, offset + length)
  const after = contextText.slice(offset + length, offset + length + 400)
  const hasBefore = offset > 400
  const hasAfter = offset + length + 400 < contextText.length

  return (
    <div className={styles.contextText}>
      {hasBefore && <span className={styles.ellipsis}>…</span>}
      {before}
      <mark className={styles.highlight}>{highlighted}</mark>
      {after}
      {hasAfter && <span className={styles.ellipsis}>…</span>}
    </div>
  )
}

export function BookmarksModal({ isOpen, onClose }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Bookmark | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/bookmarks')
      .then(r => r.json())
      .then(data => setBookmarks(Array.isArray(data) ? data : []))
      .catch(() => setBookmarks([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className={styles.overlay} onClick={() => { setSelected(null); onClose() }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Сохранённые закладки</h2>
          <button className={styles.closeBtn} onClick={() => { setSelected(null); onClose() }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {selected ? (
          <div className={styles.detail}>
            <button className={styles.backBtn} onClick={() => setSelected(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Назад
            </button>

            <div className={styles.detailCard}>
              <span className={styles.detailBadge}>{sourceLabel(selected.sourceType)}</span>
              <p className={styles.detailNote}>&ldquo;{selected.text}&rdquo;</p>
              <ContextView bookmark={selected} />
              <Link
                href={sourceHref(selected)}
                className={styles.goBtn}
                onClick={() => { setSelected(null); onClose() }}
              >
                Перейти к {sourceLabel(selected.sourceType).toLowerCase()}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {loading && <div className={styles.empty}>Загрузка...</div>}
            {!loading && bookmarks.length === 0 && (
              <div className={styles.empty}>Закладок пока нет</div>
            )}
            {!loading && bookmarks.map(b => (
              <button key={b.id} className={styles.row} onClick={() => setSelected(b)}>
                <span className={styles.rowDot} />
                <span className={styles.rowContent}>
                  <span className={styles.rowText}>&ldquo;{b.text}&rdquo;</span>
                  <span className={styles.rowMeta}>
                    <span className={styles.rowBadge}>{sourceLabel(b.sourceType)}</span>
                    <span className={styles.rowDate}>{fmt(b.createdAt)}</span>
                  </span>
                </span>
                <svg className={styles.rowArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
