'use client'

import { Wallet } from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { onWalletChanged } from '../walletEvents'
import styles from './WalletBadge.module.scss'

// Header entry point for the wallet feature (ticket 04, .autopilot/wallet-balance),
// mirrors ChatHeaderIcon.tsx: badge polls GET /api/wallet/balance every 15s,
// hidden for logged-out visitors, links to /wallet.
export function WalletBadge() {
  const { data: session } = useSession()
  const t = useTranslations('wallet')
  const [balanceCents, setBalanceCents] = useState<number | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/wallet/balance')
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.balanceCents === 'number') setBalanceCents(data.balanceCents)
    } catch {
      // ignore — badge just stays at its last known value
    }
  }, [session?.user])

  useEffect(() => {
    if (!session?.user) return
    fetchBalance()
    const interval = setInterval(fetchBalance, 15_000)
    return () => clearInterval(interval)
  }, [fetchBalance, session?.user])

  useEffect(() => {
    if (!session?.user) return
    return onWalletChanged(fetchBalance)
  }, [fetchBalance, session?.user])

  if (!session?.user) return null

  return (
    <Link href="/wallet" className={styles.btn} aria-label={t('title')}>
      <Wallet size={18} strokeWidth={2} />
      <span className={styles.amount}>
        {balanceCents === null ? '—' : `$${(balanceCents / 100).toFixed(2)}`}
      </span>
    </Link>
  )
}
