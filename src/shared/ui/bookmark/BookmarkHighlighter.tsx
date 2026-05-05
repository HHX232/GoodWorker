'use client'

import { useBookmarks } from '@/features/hooks/Bookmark/useBookmarks'
import { highlightBookmark } from '@/shared/helpers/xpath/xpath'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './BookmarkHighlighter.module.scss'

interface Props {
  postId: string
}

interface TooltipState {
  id: string
  top: number
  left: number
}

export function BookmarkHighlighter({ postId }: Props) {
  const { bookmarks, remove } = useBookmarks('post', postId)
  const initializedRef = useRef(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    if (!bookmarks.length) return

    const delay = initializedRef.current ? 0 : 800
    initializedRef.current = true

    const timer = setTimeout(() => {
      bookmarks.forEach((b) => highlightBookmark(b))

      document.querySelectorAll<HTMLElement>('.bookmark-highlight').forEach((el) => {
        el.onclick = (e) => {
          e.stopPropagation()
          const rect = el.getBoundingClientRect()
          setTooltip({
            id: el.dataset.bookmarkId!,
            top: rect.bottom + 6,
            left: rect.left + rect.width / 2,
          })
        }
      })
    }, delay)

    return () => clearTimeout(timer)
  }, [bookmarks])

  useEffect(() => {
    if (!tooltip) return
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-bookmark-tooltip]')) setTooltip(null)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [tooltip])

  const handleConfirm = () => {
    if (!tooltip) return
    remove(tooltip.id)
    const el = document.querySelector<HTMLElement>(`[data-bookmark-id="${tooltip.id}"]`)
    if (el) el.replaceWith(...Array.from(el.childNodes))
    setTooltip(null)
  }

  if (!tooltip) return null

  return createPortal(
    <div
      data-bookmark-tooltip
      className={styles.tooltip}
      style={{ top: tooltip.top, left: tooltip.left }}
    >
      <div className={styles.arrow} />
      <p className={styles.question}>Удалить закладку?</p>
      <div className={styles.actions}>
        <button className={styles.cancel_btn} onClick={() => setTooltip(null)}>
          Отмена
        </button>
        <button className={styles.delete_btn} onClick={handleConfirm}>
          Удалить
        </button>
      </div>
    </div>,
    document.body
  )
}
