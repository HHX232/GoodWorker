'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import styles from './Settings.module.scss'

/**
 * Native modal <dialog>: the browser makes the page inert (focus stays inside), Esc closes;
 * a click on the backdrop closes too. Phones get a bottom sheet (CSS).
 */
export function ChessDialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const t = useTranslations('chess.play')
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ''}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault() // Esc: let the parent own `open`
        onClose()
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && (
        <div className={styles.sheet}>
          <header className={styles.sheetHead}>
            <h2 id={id} className={styles.sheetTitle}>{title}</h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label={t('ng_close')}>
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}
