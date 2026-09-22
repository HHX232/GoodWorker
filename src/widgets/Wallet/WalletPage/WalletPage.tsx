'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import styles from './WalletPage.module.scss'

interface BalanceResponse {
  balanceCents: number
  isVip: boolean
  vipExpiresAt: string | null
}

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

const MIN_DEPOSIT_DOLLARS = 1
const MAX_DEPOSIT_DOLLARS = 1000
const VIP_BONUS_THRESHOLD_DOLLARS = 5

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function WalletPage() {
  const t = useTranslations('wallet')

  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)

  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [amount, setAmount] = useState('5')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/balance')
      if (!res.ok) return
      setBalance(await res.json())
    } catch {
      // ignore — panel just keeps its last known value
    } finally {
      setBalanceLoading(false)
    }
  }, [])

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

  useEffect(() => {
    fetchBalance()
    fetchHistory()
  }, [fetchBalance, fetchHistory])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setFormError(null)
      setSuccessMessage(null)

      const dollars = Number(amount)
      if (!Number.isInteger(dollars) || dollars < MIN_DEPOSIT_DOLLARS || dollars > MAX_DEPOSIT_DOLLARS) {
        setFormError(t('form.invalidAmount', { min: MIN_DEPOSIT_DOLLARS, max: MAX_DEPOSIT_DOLLARS }))
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/wallet/topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountCents: dollars * 100 }),
        })
        const data = await res.json()
        if (!res.ok) {
          setFormError(data?.message || t('form.genericError'))
          return
        }
        setBalance(prev => (prev ? { ...prev, balanceCents: data.balanceCents } : prev))
        setSuccessMessage(
          data.vipMonthsGranted > 0
            ? t('form.successWithVip', { amount: dollars, months: data.vipMonthsGranted })
            : t('form.success', { amount: dollars }),
        )
        fetchHistory()
      } catch {
        setFormError(t('form.genericError'))
      } finally {
        setSubmitting(false)
      }
    },
    [amount, t, fetchHistory],
  )

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
