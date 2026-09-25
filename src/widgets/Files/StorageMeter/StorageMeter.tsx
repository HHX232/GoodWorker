'use client'

import type { UsageResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useLocale, useTranslations } from 'next-intl'
import { FilesStorageIcon } from '../icons'
import { formatBytes, formatMoney } from '../lib'
import styles from './StorageMeter.module.scss'

/**
 * The storage line at the top of /files (G02): how much of the free 7 GB is
 * used, how much is over it, and what the month-end charge would be at the
 * current price — in BYN on ru, USD elsewhere.
 */
export function StorageMeter({ usage }: { usage: UsageResponse }) {
  const t = useTranslations('files')
  const locale = useLocale()
  const { usedBytes, quotaBytes, overageGb, priceCentsPerGbMonth, estimatedChargeCents, usdToBynRate } = usage
  const over = usedBytes > quotaBytes
  const overBytes = Math.max(0, usedBytes - quotaBytes)
  // Over the limit the bar rescales to the total, so the free part and the
  // paid part are both visible and the quota mark sits where 7 GB is.
  const scale = over ? usedBytes : quotaBytes
  const freePct = (Math.min(usedBytes, quotaBytes) / scale) * 100
  const overPct = (overBytes / scale) * 100
  const quotaPct = (quotaBytes / scale) * 100
  const size = (b: number) => formatBytes(b, locale)

  return (
    <div className={`${styles.meter} ${over ? styles.isOver : ''}`}>
      <div className={styles.row}>
        <FilesStorageIcon size={15} className={styles.icon} />
        <span className={styles.main}>{t('storageFree', { used: size(Math.min(usedBytes, quotaBytes)), quota: size(quotaBytes) })}</span>
        {over ? (
          <span className={styles.overLabel}>{t('storageOver', { over: size(overBytes) })}</span>
        ) : (
          <span className={styles.muted}>{t('storageLeft', { left: size(quotaBytes - usedBytes) })}</span>
        )}
      </div>
      <div className={styles.bar} role="img" aria-label={t('storageFree', { used: size(usedBytes), quota: size(quotaBytes) })}>
        <span className={styles.free} style={{ width: `${freePct}%` }} />
        {over && <span className={styles.over} style={{ left: `${quotaPct}%`, width: `${overPct}%` }} />}
        {over && <span className={styles.mark} style={{ left: `${quotaPct}%` }} />}
      </div>
      {over && (
        <div className={styles.charge}>
          {priceCentsPerGbMonth > 0
            ? t('storageCharge', { amount: formatMoney(estimatedChargeCents, locale, usdToBynRate), gb: overageGb, price: formatMoney(priceCentsPerGbMonth, locale, usdToBynRate) })
            : t('storageChargeNone')}
        </div>
      )}
    </div>
  )
}
