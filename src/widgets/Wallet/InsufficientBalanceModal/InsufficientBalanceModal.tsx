'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './InsufficientBalanceModal.module.scss'

interface InsufficientBalanceModalProps {
  /** From the 402 body: how much the call would have cost, in cents. */
  neededCents: number
  /** From the 402 body: what the user actually has, in cents. */
  availableCents: number
  onClose: () => void
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Shown whenever any of the 7 paid AI endpoints answers 402 INSUFFICIENT_BALANCE.
 * Purely informational — links to /wallet, never redirects on its own.
 *
 * Portals into the app's shared #modal_portal (same target as ModalWindowDefault /
 * ModalImageZoom) so it always renders relative to the viewport, not to whichever host
 * modal triggered it — several hosts (e.g. LessonPlanModal's ModalWindowDefault) have an
 * ancestor with a non-`none` CSS transform, which would otherwise reposition/clip this
 * modal's `position: fixed` instead of covering the whole screen.
 */
export function InsufficientBalanceModal({ neededCents, availableCents, onClose }: InsufficientBalanceModalProps) {
  const t = useTranslations('wallet.insufficientModal')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const shortfallCents = Math.max(0, neededCents - availableCents)

  // React portals still bubble synthetic events along the React component tree (not the
  // DOM tree), so a click here would otherwise reach the host modal's own backdrop
  // onClick (several hosts, e.g. FormulaPhotoModal, close on any bubbled click without
  // checking e.target === e.currentTarget) and dismiss it too, losing the user's state.
  // Stop propagation on every action that closes this modal so the host never sees it.
  const stopAndClose = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    onClose()
  }

  if (!mounted) return null
  const portalTarget = document.getElementById('modal_portal') ?? document.body

  return createPortal(
    <div className={styles.backdrop} onClick={stopAndClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('title')}>
        <div className={styles.title}>{t('title')}</div>
        <p className={styles.message}>{t('message', { amount: formatDollars(shortfallCents) })}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={stopAndClose}>
            {t('cancel')}
          </button>
          <Link href="/wallet" className={styles.topUp} onClick={stopAndClose}>
            {t('topUp')}
          </Link>
        </div>
      </div>
    </div>,
    portalTarget,
  )
}
