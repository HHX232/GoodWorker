'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FilesCloseIcon } from '../icons'
import styles from './BookModal.module.scss'

interface BookModalProps {
  title: ReactNode
  closeLabel: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Locked while a request is in flight: Esc / backdrop / × do nothing. */
  locked?: boolean
  /** Changes with the dialog's content (the upload steps): focus moves to the new `[data-autofocus]`. */
  focusKey?: string | number
}

/**
 * The wide modal of the book kit (FilesModal tops out at 480px; the quick view
 * and the cover editor need two columns). Same portal as FilesModal, plus a
 * focus trap and focus return — a dialog you can drive by keyboard.
 */
export function BookModal({ title, closeLabel, onClose, children, footer, locked = false, focusKey }: BookModalProps) {
  const [mounted, setMounted] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const close = () => { if (!locked) onClose() }
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close })

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const dialog = dialogRef.current
    const before = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(el => el.offsetParent !== null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) { e.preventDefault(); return }
      const first = list[0]
      const last = list[list.length - 1]
      // Focus slipped out (the focused node was removed by a step change) — pull it back instead of letting Tab leave the dialog.
      if (!dialog?.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); before?.focus?.({ preventScroll: true }) }
  }, [mounted])

  // On open and after every content change: focus the step's primary control (or the dialog itself).
  useEffect(() => {
    if (!mounted) return
    const dialog = dialogRef.current
    ;(dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog)?.focus({ preventScroll: true })
  }, [mounted, focusKey])

  if (!mounted) return null
  const target = document.getElementById('modal_portal') ?? document.body

  return createPortal(
    <div className={styles.backdrop} onClick={e => { e.stopPropagation(); close() }}>
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={e => { e.stopPropagation(); close() }} aria-label={closeLabel} disabled={locked}>
            <FilesCloseIcon size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    target,
  )
}
