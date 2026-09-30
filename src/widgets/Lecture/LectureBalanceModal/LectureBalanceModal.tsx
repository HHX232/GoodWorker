'use client'

import { GiftIcon, WalletIcon } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './LectureBalanceModal.module.scss'

interface LectureBalanceModalProps {
  /** Cents the one-time VIP gift just credited (0 = the plain "top up" message). */
  giftCents: number
  /** The recording was running when the money ran out — the gift offers to go on. */
  wasRecording: boolean
  onContinue: () => void
  onClose: () => void
}

/**
 * The lecture page's 402: the recording is already stopped. Without a gift —
 * "top up to continue". Once per VIP account — "we're giving you a little
 * balance to finish" with a button that resumes the recording.
 * Portals into #modal_portal like InsufficientBalanceModal (see there why).
 */
export function LectureBalanceModal({ giftCents, wasRecording, onContinue, onClose }: LectureBalanceModalProps) {
  const t = useTranslations('lecture.balance')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const gift = giftCents > 0
  const amount = `$${(giftCents / 100).toFixed(2)}`

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={gift ? t('giftTitle') : t('title')}>
        <span className={`${styles.icon} ${gift ? styles.iconGift : ''}`} aria-hidden>{gift ? <GiftIcon size={22} /> : <WalletIcon size={22} />}</span>
        <div className={styles.title}>{gift ? t('giftTitle') : t('title')}</div>
        {gift ? (
          <>
            <p className={styles.message}>{t('giftText')}</p>
            <div className={styles.giftAmount}>+{amount}</div>
            <p className={styles.note}>{t('giftNote', { amount })}</p>
          </>
        ) : (
          <p className={styles.message}>{wasRecording ? t('stopped') : t('text')}</p>
        )}
        <div className={styles.actions}>
          {gift ? (
            <>
              <Link href="/wallet" className={styles.secondary} onClick={onClose}>{t('topUp')}</Link>
              <button type="button" className={styles.primary} onClick={() => { onClose(); if (wasRecording) onContinue() }}>
                {wasRecording ? t('continue') : t('ok')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.secondary} onClick={onClose}>{t('close')}</button>
              <Link href="/wallet" className={styles.primary} onClick={onClose}>{t('topUp')}</Link>
            </>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('modal_portal') ?? document.body,
  )
}
