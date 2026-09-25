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
import { MonthlyFeeCard } from '../MonthlyFeeCard/MonthlyFeeCard'
import { VipMechanic } from '../VipMechanic/VipMechanic'
import styles from './WalletPage.module.scss'

interface TransactionItem {
  id: string
  type: 'DEPOSIT' | 'AI_DEBIT' | 'FEATURED_POSTS_PURCHASE' | 'PINNED_LISTING_PURCHASE' | 'STORAGE_OVERAGE_DEBIT' | 'MONTHLY_FEE' | 'PROMO_BONUS'
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

  // Theme tokens (light by default, dark under html.theme-dark) are declared
  // on html.wallet-page in WalletPage.module.scss — on <html>, not on this
  // div, so fixed/portalled children (payment modal, "view all" history
  // modal) inherit them too. Same add-on-mount pattern as /vip's vip-dark.
  useEffect(() => {
    document.documentElement.classList.add('wallet-page')
    return () => document.documentElement.classList.remove('wallet-page')
  }, [])

  // Bumped after a top-up so the monthly-fee block re-reads its status.
  const [refreshKey, setRefreshKey] = useState(0)

  const { balance, balanceLoading, fetchBalance } = useTopUpForm(t)

  const { data: session } = useSession()
  const sessionRole = (session?.user as { role?: string } | undefined)?.role
  const isTeacher = sessionRole === 'TEACHER' || sessionRole === 'ADMIN'

  return (
    <div className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <h1 className={styles.title}>{t('title')}</h1>

        <MonthlyFeeCard refreshKey={refreshKey} />

        <div className={styles.layout}>
          <div className={styles.leftCol}>
            <TopUpCard
              balanceCents={balance?.balanceCents}
              balanceLoading={balanceLoading}
              onSuccess={() => { fetchBalance(); fetchHistory(); setRefreshKey(k => k + 1) }}
            />
            <SpendChart transactions={transactions} />
          </div>

          <div className={styles.rightCol}>
            <TransactionsTable transactions={transactions} historyLoading={historyLoading} />
          </div>
        </div>

        <section className={styles.offers}>
          <p className={styles.sectionLabel}>{t('offersLabel')}</p>
          <VipMechanic />

          {/* Teacher-only purchases from /vip: pinned listing + featured posts. */}
          {isTeacher && (
            <div className={styles.addonsPanel}>
              <PinnedListingSection />
              <FeaturedPostsAddon />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
