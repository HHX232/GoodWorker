'use client'
import {Receipt} from '@/shared/types/Receipt/receipt.types'
import styles from './ReceiptPreview.module.scss'

interface ReceiptMiniPreviewProps {
  receipt: Receipt
  onClick: () => void
}

export function ReceiptMiniPreview({receipt, onClick}: ReceiptMiniPreviewProps) {
  return (
    <button type='button' className={styles.mini} onClick={onClick}>
      <div className={styles.mini_status}>
        <span className={styles.mini_dot} />
        <span className={styles.mini_status_text}>Оплачено</span>
      </div>

      <p className={styles.mini_amount}>
        {receipt.amount.toLocaleString('ru')}
        <span className={styles.mini_currency}> {receipt.currency}</span>
      </p>
      <p className={styles.mini_subject}>{receipt.subject}</p>

      <div className={styles.mini_divider} />

      <div className={styles.mini_rows}>
        <div className={styles.mini_row}>
          <span className={styles.mini_k}>Дата</span>
          <span className={styles.mini_v}>{receipt.date}</span>
        </div>
        <div className={styles.mini_row}>
          <span className={styles.mini_k}>Способ</span>
          <span className={styles.mini_v}>{receipt.payMethod}</span>
        </div>
      </div>

      <div className={styles.mini_footer}>
        <span className={styles.mini_tx}>#{receipt.txId.slice(-6)}</span>
        <span className={styles.mini_cta}>
          Открыть
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
