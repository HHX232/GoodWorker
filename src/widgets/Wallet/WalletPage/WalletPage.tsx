'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { useTopUpForm } from '../useTopUpForm'
import { TopUpCard } from '../TopUpCard/TopUpCard'
import { SpendChart } from '../SpendChart/SpendChart'
import { TransactionsTable } from '../TransactionsTable/TransactionsTable'
import { PinnedListingSection } from '../PinnedListingSection/PinnedListingSection'
import { FeaturedPostsAddon } from '../FeaturedPostsAddon/FeaturedPostsAddon'
import styles from './WalletPage.module.scss'

interface TransactionItem {
  id: string
  type: 'DEPOSIT' | 'AI_DEBIT' | 'FEATURED_POSTS_PURCHASE' | 'PINNED_LISTING_PURCHASE'
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
  const [historyLoading, setHistoryLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      // Feeds both the table's preview rows and the spend chart's weekly
      // aggregation — the full paginated history (past this) is fetched
      // separately by TransactionsTable's own "view all" modal.
      const res = await fetch('/api/wallet/transactions?limit=90')
      if (!res.ok) return
      const data: TransactionsResponse = await res.json()
      setTransactions(data.items)
    } catch {
      // ignore — history section shows what it already has
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const { balance, balanceLoading, fetchBalance } = useTopUpForm(t)

  const { data: session } = useSession()
  const sessionRole = (session?.user as { role?: string } | undefined)?.role
  const isTeacher = sessionRole === 'TEACHER' || sessionRole === 'ADMIN'

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>{t('title')}</h1>

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <TopUpCard
            balanceCents={balance?.balanceCents}
            balanceLoading={balanceLoading}
            onSuccess={() => { fetchBalance(); fetchHistory() }}
          />
          <SpendChart transactions={transactions} />
        </div>

        <div className={styles.rightCol}>
          <TransactionsTable transactions={transactions} historyLoading={historyLoading} />
        </div>
      </div>

      {/* Teacher-only purchases: pinned listing + featured posts — same dark
          card styling as the VIP page these were lifted from, wrapped so they
          read fine on /wallet's light background. */}
      {isTeacher && (
        <div className={styles.addonsPanel}>
          <PinnedListingSection />
          <FeaturedPostsAddon />
        </div>
      )}
    </div>
  )
}
