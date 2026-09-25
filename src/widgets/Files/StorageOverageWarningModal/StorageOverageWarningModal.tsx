'use client'

import type { UsageResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { FilesModal } from '../FilesModal/FilesModal'
import { formatBytes, formatMoney } from '../lib'
import ui from '../ui.module.scss'
import styles from './StorageOverageWarningModal.module.scss'

/**
 * G02: shown once, right after the upload that first takes the library over
 * the quota (Wallet build only — without billing uploads past it are refused). Informational only — the upload already succeeded; billing is
 * the monthly cron. With price 0 (admin hasn't set it) no amount is invented.
 * Amounts in BYN on ru, USD elsewhere (formatMoney).
 */
export function StorageOverageWarningModal({ usage, onClose }: { usage: UsageResponse; onClose: () => void }) {
  const t = useTranslations('files')
  const locale = useLocale()
  const billing = usage.billing
  const price = billing ? formatMoney(billing.priceCentsPerGbMonth, locale, billing.usdToBynRate) : ''

  return (
    <FilesModal
      title={t('overageTitle', { quota: formatBytes(usage.quotaBytes, locale) })}
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
        {billing && billing.priceCentsPerGbMonth > 0
          ? t('overageText', { gb: usage.overageGb, price, quota: formatBytes(usage.quotaBytes, locale) })
          : t('overageNoPrice', { gb: usage.overageGb })}
      </p>
    </FilesModal>
  )
}
