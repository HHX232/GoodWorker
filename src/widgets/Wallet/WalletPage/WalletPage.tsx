'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { formatCents, MAX_DEPOSIT_DOLLARS, MIN_DEPOSIT_DOLLARS, useTopUpForm, VIP_BONUS_THRESHOLD_DOLLARS } from '../useTopUpForm'
import styles from './WalletPage.module.scss'

interface TransactionItem {
  id: string
  type: 'DEPOSIT' | 'AI_DEBIT'
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

export function WalletPage() {
  const t = useTranslations('wallet')

  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchHistory = useCallback(async (cursor?: string | null) => {
    if (cursor) setLoadingMore(true)
    else setHistoryLoading(true)
    try {
      const url = cursor ? `/api/wallet/transactions?cursor=${encodeURIComponent(cursor)}` : '/api/wallet/transactions'
      const res = await fetch(url)
      if (!res.ok) return
      const data: TransactionsResponse = await res.json()
      setTransactions(prev => (cursor ? [...prev, ...data.items] : data.items))
      setNextCursor(data.nextCursor)
    } catch {
      // ignore — history section shows what it already has
    } finally {
      setHistoryLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const {
    balance, balanceLoading,
    amount, setAmount,
    formError, submitting, successMessage,
    handleSubmit,
  } = useTopUpForm(t, fetchHistory)

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>{t('title')}</h1>

      <section className={styles.balanceCard}>
        <span className={styles.balanceLabel}>{t('currentBalance')}</span>
        <span className={styles.balanceValue}>
          {balanceLoading ? '…' : formatCents(balance?.balanceCents ?? 0)}
        </span>
        {!balanceLoading && (balance?.balanceCents ?? 0) === 0 && (
          <span className={styles.balanceHint}>{t('zeroBalanceHint')}</span>
        )}
      </section>

      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>{t('form.title')}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>{t('form.amountLabel')}</span>
            <div className={styles.amountInputRow}>
              <span className={styles.currencyPrefix}>$</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                min={MIN_DEPOSIT_DOLLARS}
                max={MAX_DEPOSIT_DOLLARS}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={styles.amountInput}
              />
            </div>
          </label>
          <p className={styles.vipHint}>{t('form.vipHint', { threshold: VIP_BONUS_THRESHOLD_DOLLARS })}</p>
          {formError && <p className={styles.errorText}>{formError}</p>}
          {successMessage && <p className={styles.successText}>{successMessage}</p>}
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? t('form.submitting') : t('form.submit')}
          </button>
        </form>
      </section>

      <section className={styles.historyCard}>
        <h2 className={styles.sectionTitle}>{t('history.title')}</h2>
        {historyLoading ? (
          <p className={styles.muted}>{t('history.loading')}</p>
        ) : transactions.length === 0 ? (
          <p className={styles.muted}>{t('history.empty')}</p>
        ) : (
          <ul className={styles.historyList}>
            {transactions.map(item => (
              <li key={item.id} className={styles.historyRow}>
                <div className={styles.historyMain}>
                  <span className={styles.historyDescription}>{item.description}</span>
                  <span className={styles.historyDate}>
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className={item.type === 'DEPOSIT' ? styles.historyAmountPositive : styles.historyAmountNegative}>
                  {item.type === 'DEPOSIT' ? '+' : '-'}
                  {formatCents(item.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && (
          <button
            type="button"
            className={styles.loadMoreBtn}
            onClick={() => fetchHistory(nextCursor)}
            disabled={loadingMore}
          >
            {loadingMore ? t('history.loading') : t('history.loadMore')}
          </button>
        )}
      </section>
    </div>
  )
}
