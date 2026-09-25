'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { FilesMoreIcon } from '../icons'
import styles from './CardMenu.module.scss'

export interface CardMenuItem {
  label: string
  icon: ComponentType<{ size?: number }>
  onSelect: () => void
  danger?: boolean
}

/** The ⋮ pill in a card's corner (Floe) — a small popover of item actions. */
export function CardMenu({ items, label }: { items: CardMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FilesMoreIcon size={15} />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.danger : ''}`}
              onClick={e => { e.stopPropagation(); setOpen(false); item.onSelect() }}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
