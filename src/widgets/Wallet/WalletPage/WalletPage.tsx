'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useTopUpForm } from '../useTopUpForm'
import { TopUpCard } from '../TopUpCard/TopUpCard'
import { SpendChart } from '../SpendChart/SpendChart'
import { TransactionsTable } from '../TransactionsTable/TransactionsTable'
import { PinnedListingSection } from '../PinnedListingSection/PinnedListingSection'
import { FeaturedPostsAddon } from '../FeaturedPostsAddon/FeaturedPostsAddon'
import { MonthlyFeeCard } from '../MonthlyFeeCard/MonthlyFeeCard'
import { VipMechanic } from '../VipMechanic/VipMechanic'
import { onWalletChanged } from '../walletEvents'
import styles from './WalletPage.module.scss'

export function WalletPage() {
  const t = useTranslations('wallet')

  // Theme tokens (light by default, dark under html.theme-dark) are declared
  // on html.wallet-page in WalletPage.module.scss — on <html>, not on this
  // div, so fixed/portalled children (payment modal, fee details modal)
  // inherit them too. Same add-on-mount pattern as /vip's vip-dark.
  useEffect(() => {
    document.documentElement.classList.add('wallet-page')
    return () => document.documentElement.classList.remove('wallet-page')
  }, [])

  // Bumped whenever money moves (top-up here, add-on purchase, etc. — all of
  // them fire notifyWalletChanged) so the fee strip, chart and history
  // re-fetch.
  const [refreshKey, setRefreshKey] = useState(0)

  const { balance, balanceLoading, fetchBalance } = useTopUpForm(t)

  useEffect(() => onWalletChanged(() => { fetchBalance(); setRefreshKey(k => k + 1) }), [fetchBalance])

  const { data: session } = useSession()
  const sessionRole = (session?.user as { role?: string } | undefined)?.role
  const isTeacher = sessionRole === 'TEACHER' || sessionRole === 'ADMIN'

  return (
    <div className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <h1 className={styles.title}>{t('title')}</h1>

        <MonthlyFeeCard refreshKey={refreshKey} />

        {/* Main block: buy on the left (top-up, then teacher add-ons), see on
            the right (spend chart above history). 90vh on desktop — see
            .layout in WalletPage.module.scss. */}
        <div className={styles.layout}>
          <div className={styles.leftCol}>
            <TopUpCard
              balanceCents={balance?.balanceCents}
              balanceLoading={balanceLoading}
              onSuccess={() => { fetchBalance(); setRefreshKey(k => k + 1) }}
            />

            {/* Teacher-only purchases from /vip: pinned listing + featured posts. */}
            {isTeacher && (
              <div className={styles.addonsPanel}>
                <PinnedListingSection />
                <FeaturedPostsAddon />
              </div>
            )}
          </div>

          <div className={styles.rightCol}>
            <SpendChart refreshKey={refreshKey} />
            <div className={styles.historySlot}>
              <TransactionsTable refreshKey={refreshKey} />
            </div>
          </div>
        </div>

        <section className={styles.offers}>
          <p className={styles.sectionLabel}>{t('offersLabel')}</p>
          <VipMechanic />
        </section>
      </div>
    </div>
  )
}
