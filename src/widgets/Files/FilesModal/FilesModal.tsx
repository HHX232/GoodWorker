'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FilesCloseIcon } from '../icons'
import styles from './FilesModal.module.scss'

interface FilesModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** `wide` for the share list, `viewer` for the full-bleed preview. */
  size?: 'default' | 'wide' | 'viewer'
  closeLabel: string
}

/**
 * Shared shell for every Files modal — same portal mechanics as
 * InsufficientBalanceModal: renders into #modal_portal (fallback
 * document.body) so a transformed ancestor can't clip `position: fixed`, and
 * stops propagation on close/inside clicks because React portals still bubble
 * synthetic events up the component tree to whichever card/modal opened it.
 */
export function FilesModal({ title, onClose, children, footer, size = 'default', closeLabel }: FilesModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null
  const portalTarget = document.getElementById('modal_portal') ?? document.body

  return createPortal(
    <div className={styles.backdrop} onClick={e => { e.stopPropagation(); onClose() }}>
      <div
        className={`${styles.modal} ${styles[size]}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button type="button" className={styles.close} onClick={e => { e.stopPropagation(); onClose() }} aria-label={closeLabel}>
            <FilesCloseIcon size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    portalTarget,
  )
}
