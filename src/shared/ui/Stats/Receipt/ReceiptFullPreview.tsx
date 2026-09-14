'use client'
import {Receipt} from '@/shared/types/Receipt/receipt.types'
import {useTranslations} from 'next-intl'
import styles from './ReceiptPreview.module.scss'

interface ReceiptFullPreviewProps {
  receipt: Receipt
  onBack: () => void
}

function Row({label, value}: {label: string; value: string}) {
  return (
    <div className={styles.full_row}>
      <span className={styles.full_k}>{label}</span>
      <span className={styles.full_v}>{value}</span>
    </div>
  )
}

function SectionLabel({children}: {children: React.ReactNode}) {
  return <p className={styles.full_section_label}>{children}</p>
}

const STATUS_ICON: Record<Receipt['status'], string> = {
  paid: styles.icon_paid,
  unpaid: styles.icon_unpaid,
  planned: styles.icon_planned,
}

export function ReceiptFullPreview({receipt, onBack}: ReceiptFullPreviewProps) {
  const t = useTranslations('statsPage.heroCard')

  return (
    <div className={styles.full}>
      <button type='button' className={styles.full_back} onClick={onBack}>
        <svg width='13' height='13' viewBox='0 0 13 13' fill='none'>
          <path
            d='M11 6.5H2M5.5 3 2 6.5l3.5 3.5'
            stroke='currentColor'
            strokeWidth='1.3'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
        {t('allReceipts')}
      </button>

      <div className={styles.full_header}>
        <div className={`${styles.full_check} ${STATUS_ICON[receipt.status]}`}>
          {receipt.status === 'paid' && (
            <svg viewBox='0 0 20 20' fill='none'>
              <path d='M4 10.5 8 14.5 16 6.5' stroke='#27500A' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          )}
          {receipt.status === 'unpaid' && (
            <svg viewBox='0 0 20 20' fill='none'>
              <path d='M10 5.5v6M10 14.2v.1' stroke='#7A2020' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          )}
          {receipt.status === 'planned' && (
            <svg viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='6' stroke='#1B4A8A' strokeWidth='1.6' />
              <path d='M10 7v3.2l2.2 1.3' stroke='#1B4A8A' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          )}
        </div>
        <p className={styles.full_title}>{t(`fullTitle_${receipt.status}`)}</p>
        <p className={styles.full_subtitle}>{t(`fullSubtitle_${receipt.status}`)}</p>
      </div>

      <div className={styles.full_block}>
        <SectionLabel>{t('lessonSection')}</SectionLabel>
        <Row label={t('subjectLabel')} value={receipt.subject} />
        {receipt.date && <Row label={t('dateLabel')} value={receipt.date} />}
        <Row label={t('amountLabel')} value={`${receipt.amount.toLocaleString('ru')} ${receipt.currency}`} />
      </div>

      <hr className={styles.full_dash} />

      <div className={styles.full_block}>
        <SectionLabel>{t('studentSection')}</SectionLabel>
        <Row label={t('nameLabel')} value={receipt.studentName} />
      </div>

      <div className={styles.full_total}>
        <span className={styles.full_total_k}>{t('total')}</span>
        <span className={styles.full_total_v}>
          {receipt.amount.toLocaleString('ru')} {receipt.currency}
        </span>
      </div>
    </div>
  )
}
