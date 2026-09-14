'use client'
import {Receipt} from '@/shared/types/Receipt/receipt.types'
import {useTranslations} from 'next-intl'
import styles from './ReceiptPreview.module.scss'

interface ReceiptMiniPreviewProps {
  receipt: Receipt
  onClick: () => void
}

const STATUS_CLASS: Record<Receipt['status'], string> = {
  paid: styles.status_paid,
  unpaid: styles.status_unpaid,
  planned: styles.status_planned,
}

export function ReceiptMiniPreview({receipt, onClick}: ReceiptMiniPreviewProps) {
  const t = useTranslations('statsPage.heroCard')

  return (
    <button type='button' className={styles.mini} onClick={onClick}>
      <div className={`${styles.mini_status} ${STATUS_CLASS[receipt.status]}`}>
        <span className={styles.mini_dot} />
        <span className={styles.mini_status_text}>{t(`status_${receipt.status}`)}</span>
      </div>

      <p className={styles.mini_amount}>
        {receipt.amount.toLocaleString('ru')}
        <span className={styles.mini_currency}> {receipt.currency}</span>
      </p>
      <p className={styles.mini_subject}>{receipt.subject}</p>

      <div className={styles.mini_divider} />

      <div className={styles.mini_rows}>
        {receipt.date && (
          <div className={styles.mini_row}>
            <span className={styles.mini_k}>{t('dateLabel')}</span>
            <span className={styles.mini_v}>{receipt.date}</span>
          </div>
        )}
        <div className={styles.mini_row}>
          <span className={styles.mini_k}>{t('studentLabel')}</span>
          <span className={styles.mini_v}>{receipt.studentName}</span>
        </div>
      </div>

      <div className={styles.mini_footer}>
        <span className={styles.mini_cta}>
          {t('open')}
          <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
            <path
              d='M2 5h6M5.5 2.5 8 5 5.5 7.5'
              stroke='currentColor'
              strokeWidth='1.2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </span>
      </div>
    </button>
  )
}
