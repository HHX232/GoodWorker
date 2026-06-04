'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './CardOwnerMenu.module.scss'

interface Props {
  onDelete: () => void
  deleteLabel: string
}

export function CardOwnerMenu({ onDelete, deleteLabel }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div
      ref={ref}
      className={styles.wrap}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        aria-label="More options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className={styles.menu}>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete() }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  )
}
