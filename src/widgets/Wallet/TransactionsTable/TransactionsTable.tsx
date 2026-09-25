'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { formatCents } from '../useTopUpForm'
import styles from './TransactionsTable.module.scss'

interface TransactionItem {
  id: string
  type: 'DEPOSIT' | 'AI_DEBIT' | 'FEATURED_POSTS_PURCHASE' | 'PINNED_LISTING_PURCHASE' | 'STORAGE_OVERAGE_DEBIT' | 'MONTHLY_FEE'
  amountCents: number
  balanceAfterCents: number
  endpoint: string | null
  description: string
  createdAt: string
}

interface TransactionsResponse {
  items: TransactionItem[]
  nextCursor: string | null
}

// Matches the reference's four distinct .ops-row__type-- colors
// (wallet-a-3d.html) instead of lumping both addon purchases into one.
const TYPE_BADGE_CLASS: Record<TransactionItem['type'], string> = {
  DEPOSIT: styles.badgeDeposit,
  AI_DEBIT: styles.badgeDebit,
  FEATURED_POSTS_PURCHASE: styles.badgePromo,
  PINNED_LISTING_PURCHASE: styles.badgePin,
  STORAGE_OVERAGE_DEBIT: styles.badgeStorage,
  MONTHLY_FEE: styles.badgeFee,
}

const PREVIEW_COUNT = 8
const PAGE_SIZE = 15
// The wallet API is cursor-only (no skip/offset), so jumping straight to page
// N needs the whole list in memory first — fine at personal-wallet scale.
// Ceiling: if this ever needs to page through thousands of rows, switch to
// server-side offset pagination instead of raising this number.
const MAX_FETCH_ROWS = 300

type Translate = (key: string, values?: Record<string, string | number>) => string

function TransactionRows({ items, locale, t }: { items: TransactionItem[]; locale: string; t: Translate }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('history.colDate')}</th>
            <th>{t('history.colDescription')}</th>
            <th>{t('history.colType')}</th>
            <th className={styles.numeric}>{t('history.colAmount')}</th>
            <th className={styles.numeric}>{t('history.colBalance')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className={item.type === 'DEPOSIT' ? styles.rowDeposit : undefined}>
              <td className={styles.dateCell}>
                {new Date(item.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </td>
              <td className={styles.descCell}>{item.description}</td>
              <td>
                <span className={`${styles.badge} ${TYPE_BADGE_CLASS[item.type]}`}>
                  {t(`history.types.${item.type}`)}
                </span>
              </td>
              <td className={`${styles.numeric} ${item.type === 'DEPOSIT' ? styles.amountPositive : styles.amountNegative}`}>
                {item.type === 'DEPOSIT'
                  ? <span>+{formatCents(item.amountCents)}</span>
                  : <>−{formatCents(item.amountCents)}</>}
              </td>
              <td className={`${styles.numeric} ${styles.balanceCell}`}>{formatCents(item.balanceAfterCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Props {
  transactions: TransactionItem[]
  historyLoading: boolean
}

export function TransactionsTable({ transactions, historyLoading }: Props) {
  const t = useTranslations('wallet')
  const locale = useLocale()

  const [modalOpen, setModalOpen] = useState(false)
  const [allTransactions, setAllTransactions] = useState<TransactionItem[] | null>(null)
  const [loadingAll, setLoadingAll] = useState(false)
  const [page, setPage] = useState(1)

  async function openModal() {
    setModalOpen(true)
    setPage(1)
    if (allTransactions !== null) return
    setLoadingAll(true)
    try {
      let items: TransactionItem[] = []
      let cursor: string | null = null
      do {
        const url = cursor
          ? `/api/wallet/transactions?cursor=${encodeURIComponent(cursor)}&limit=100`
          : '/api/wallet/transactions?limit=100'
        const res = await fetch(url)
        if (!res.ok) break
        const data: TransactionsResponse = await res.json()
        items = items.concat(data.items)
        cursor = data.nextCursor
      } while (cursor && items.length < MAX_FETCH_ROWS)
      setAllTransactions(items)
    } catch {
      setAllTransactions([])
    } finally {
      setLoadingAll(false)
    }
  }

  const totalPages = allTransactions ? Math.max(1, Math.ceil(allTransactions.length / PAGE_SIZE)) : 1
  const pageItems = allTransactions ? allTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []

  return (
    <section className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>{t('history.title')}</h2>
        {!historyLoading && transactions.length > 0 && (
          <button type="button" className={styles.viewAllBtn} onClick={openModal}>
            {t('history.viewAll')}
          </button>
        )}
      </div>

      {historyLoading ? (
        <p className={styles.muted}>{t('history.loading')}</p>
      ) : transactions.length === 0 ? (
        <p className={styles.muted}>{t('history.empty')}</p>
      ) : (
        <TransactionRows items={transactions.slice(0, PREVIEW_COUNT)} locale={locale} t={t} />
      )}

      <ModalWindowDefault isOpen={modalOpen} onClose={() => setModalOpen(false)} additionalTitle={t('history.title')}>
        {loadingAll ? (
          <p className={styles.muted}>{t('history.loading')}</p>
        ) : (
          <>
            <TransactionRows items={pageItems} locale={locale} t={t} />
            <div className={styles.pagination}>
              <button type="button" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                {t('history.prevPage')}
              </button>
              <span className={styles.pageLabel}>{t('history.pageOf', { page, total: totalPages })}</span>
              <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                {t('history.nextPage')}
              </button>
            </div>
          </>
        )}
      </ModalWindowDefault>
    </section>
  )
}
