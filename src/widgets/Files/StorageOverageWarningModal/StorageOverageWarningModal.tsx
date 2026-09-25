'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FilesModal } from '../FilesModal/FilesModal'
import ui from '../ui.module.scss'
import styles from './StorageOverageWarningModal.module.scss'

interface StorageOverageWarningModalProps {
  overageGb: number
  /** From GET /api/tutor-files/usage — the only place the UI learns the price; 0 = not set yet. */
  priceCentsPerGbMonth: number
  onClose: () => void
}

/**
 * G02: shown once, right after the upload that first takes the library over
 * QUOTA_BYTES. Informational only — the upload already succeeded; billing is
 * the monthly cron. With price 0 (admin hasn't set it) no amount is invented.
 */
export function StorageOverageWarningModal({ overageGb, priceCentsPerGbMonth, onClose }: StorageOverageWarningModalProps) {
  const t = useTranslations('files')
  const price = `$${(priceCentsPerGbMonth / 100).toFixed(2)}`

  return (
    <FilesModal
      title={t('overageTitle')}
      closeLabel={t('close')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.btn} onClick={e => { e.stopPropagation(); onClose() }}>{t('overageOk')}</button>
          <Link href="/wallet" className={`${ui.btn} ${ui.primary}`} onClick={e => e.stopPropagation()}>{t('overageWallet')}</Link>
        </>
      }
    >
      <p className={styles.text}>
        {priceCentsPerGbMonth > 0
          ? t('overageText', { gb: overageGb, price })
          : t('overageNoPrice', { gb: overageGb })}
      </p>
    </FilesModal>
  )
}
