'use client'
import {Receipt} from '@/shared/types/Receipt/receipt.types'
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

export function ReceiptFullPreview({receipt, onBack}: ReceiptFullPreviewProps) {
  const handleDownload = () => {
    console.log('download receipt', receipt.txId)
  }

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
        Все чеки
      </button>

      <div className={styles.full_header}>
        <div className={styles.full_check}>
          <svg viewBox='0 0 20 20' fill='none'>
            <path
              d='M4 10.5 8 14.5 16 6.5'
              stroke='#27500A'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </div>
        <p className={styles.full_title}>Оплата успешно выполнена</p>
        <p className={styles.full_subtitle}>Чек сформирован. Детали платежа и занятия доступны ниже</p>
      </div>

      <div className={styles.full_block}>
        <SectionLabel>Платёж</SectionLabel>
        <Row label='Номер транзакции' value={receipt.txId} />
        <Row label='Дата оплаты' value={receipt.date} />
        <Row label='Время оплаты' value={receipt.paidAt} />
        <Row label='Сумма' value={`${receipt.amount.toLocaleString('ru')} ${receipt.currency}`} />
        <Row label='Способ оплаты' value={receipt.payMethod} />
      </div>

      <hr className={styles.full_dash} />

      <div className={styles.full_block}>
        <SectionLabel>Отправитель (ученик)</SectionLabel>
        <Row label='Имя' value={receipt.studentName} />
        <Row label='Счёт' value={receipt.studentAcc} />
      </div>

      <hr className={styles.full_dash} />

      <div className={styles.full_block}>
        <SectionLabel>Получатель (репетитор)</SectionLabel>
        <Row label='Имя' value={receipt.tutorName} />
        <Row label='Счёт' value={receipt.tutorAcc} />
      </div>

      <hr className={styles.full_dash} />

      <div className={styles.full_block}>
        <SectionLabel>Занятие</SectionLabel>
        <Row label='Предмет' value={receipt.subjectFull} />
        <Row label='Тип занятия' value={receipt.type} />
        <Row label='Дата занятия' value={receipt.date} />
        <Row label='Время занятия' value={receipt.timeRange} />
        <Row label='Длительность' value={receipt.duration} />
        <Row label='Формат' value={receipt.format} />
      </div>

      <div className={styles.full_total}>
        <span className={styles.full_total_k}>Итого</span>
        <span className={styles.full_total_v}>
          {receipt.amount.toLocaleString('ru')} {receipt.currency}
        </span>
      </div>

      <button type='button' className={styles.full_btn} onClick={handleDownload}>
        Скачать чек
      </button>
    </div>
  )
}
