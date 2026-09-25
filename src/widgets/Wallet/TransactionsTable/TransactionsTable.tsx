'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatCents } from '../useTopUpForm'
import styles from './TransactionsTable.module.scss'

interface TransactionItem {
  id: string
  type: 'DEPOSIT' | 'AI_DEBIT' | 'FEATURED_POSTS_PURCHASE' | 'PINNED_LISTING_PURCHASE' | 'STORAGE_OVERAGE_DEBIT' | 'MONTHLY_FEE' | 'PROMO_BONUS'
  amountCents: number
  balanceAfterCents: number
  endpoint: string | null
  description: string
  createdAt: string
}

interface TransactionsPageResponse {
  items: TransactionItem[]
  page: number
  totalPages: number
  total: number
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
  PROMO_BONUS: styles.badgeDeposit,
}

// Money coming IN — rendered green with a "+" (top-ups and promo-code bonus).
const isCredit = (type: TransactionItem['type']) => type === 'DEPOSIT' || type === 'PROMO_BONUS'

const PAGE_SIZE = 8

type Translate = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean }

// Ledger descriptions are stored in Russian (written server-side at charge
// time). On ru show them as-is (they carry details like months/amounts); on
// other locales translate by type — and by endpoint for AI debits.
function describe(item: TransactionItem, locale: string, t: Translate): string {
  if (locale === 'ru') return item.description
  if (item.type === 'AI_DEBIT' && item.endpoint) {
    const key = `history.desc.endpoints.${item.endpoint.replaceAll('/', '_')}`
    if (t.has(key)) return t(key)
  }
  const key = `history.desc.${item.type}`
  return t.has(key) ? t(key) : item.description
}

export function TransactionsTable({ refreshKey }: { refreshKey?: number }) {
  const t = useTranslations('wallet') as unknown as Translate
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TransactionsPageResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/wallet/transactions?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setData(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, refreshKey])

  // A top-up (refreshKey bump) puts a new row on page 1 — go back there.
  useEffect(() => { setPage(1) }, [refreshKey])

  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <section className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>{t('history.title')}</h2>
        {data && data.total > 0 && <span className={styles.totalCount}>{data.total}</span>}
      </div>

      {!data && loading ? (
        <p className={styles.muted}>{t('history.loading')}</p>
      ) : items.length === 0 ? (
        <p className={styles.muted}>{t('history.empty')}</p>
      ) : (
        <div className={`${styles.tableWrap} ${loading ? styles.tableLoading : ''}`}>
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
                <tr key={item.id} className={isCredit(item.type) ? styles.rowDeposit : undefined}>
                  <td className={styles.dateCell}>
                    {new Date(item.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                  </td>
                  <td className={styles.descCell}>{describe(item, locale, t)}</td>
                  <td>
                    <span className={`${styles.badge} ${TYPE_BADGE_CLASS[item.type]}`}>
                      {t(`history.types.${item.type}`)}
                    </span>
                  </td>
                  <td className={`${styles.numeric} ${isCredit(item.type) ? styles.amountPositive : styles.amountNegative}`}>
                    {isCredit(item.type)
                      ? <span>+{formatCents(item.amountCents)}</span>
                      : <>−{formatCents(item.amountCents)}</>}
                  </td>
                  <td className={`${styles.numeric} ${styles.balanceCell}`}>{formatCents(item.balanceAfterCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button type="button" onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading}>
            {t('history.prevPage')}
          </button>
          <span className={styles.pageLabel}>{t('history.pageOf', { page, total: totalPages })}</span>
          <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages || loading}>
            {t('history.nextPage')}
          </button>
        </div>
      )}
    </section>
  )
}
