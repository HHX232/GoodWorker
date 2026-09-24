'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { useVipTopUpPresets } from '../useVipTopUpPresets'
import { notifyWalletChanged } from '../walletEvents'
// Own module (ticket 05) — no longer shares vip.module.scss with the live
// /vip page, restyled to the wallet-a-3d.html dark 3D reference.
import styles from './FeaturedPostsAddon.module.scss'

function dateLocaleFor(locale: string) {
  return locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : locale === 'hi' ? 'hi-IN' : 'en-US'
}

export function FeaturedPostsAddon() {
  const t = useTranslations('vip')
  const locale = useLocale()
  const { pricing, balance, formatCentsDisplay, fetchBalance } = useVipTopUpPresets()
  const [open, setOpen] = useState(false)
  const [months, setMonths] = useState(1)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')

  if (!pricing) return null

  const activeUntil = balance?.postsHighlightedUntil ? new Date(balance.postsHighlightedUntil) : null
  const isActive = activeUntil !== null && activeUntil > new Date()
  const totalCents = months * pricing.featuredPostsPriceCentsPerMonth

  const handleBuy = async () => {
    setBuying(true)
    setError('')
    try {
      const res = await fetch('/api/wallet/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'FEATURED_POSTS', months }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error === 'INSUFFICIENT_BALANCE' ? t('addons.insufficientBalance') : t('addons.purchaseFailed'))
        return
      }
      toast.success(t('addons.purchaseSuccess'))
      fetchBalance()
      notifyWalletChanged()
      setOpen(false)
    } catch {
      setError(t('addons.purchaseFailed'))
    } finally {
      setBuying(false)
    }
  }

  return (
    <motion.div
      className={styles.getCard}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.getCardBody}>
        <label className={styles.toggleRow}>
          <input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)} />
          <div>
            <p className={styles.getCardTitle}>{t('addons.featuredPosts.checkboxLabel')}</p>
            <p className={styles.getCardSub}>{t('addons.featuredPosts.desc')}</p>
          </div>
        </label>

        {isActive && (
          <p className={styles.customPreview}>
            {t('addons.featuredPosts.activeUntil', { date: activeUntil!.toLocaleDateString(dateLocaleFor(locale)) })}
          </p>
        )}

        {open && (
          <div className={styles.sliderBlock}>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min={1}
                max={12}
                value={months}
                onChange={e => setMonths(Number(e.target.value))}
                aria-label={t('addons.featuredPosts.monthsLabel')}
              />
              <span className={styles.sliderValue}>{t('addons.monthsCount', { count: months })}</span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.priceDisplay}>{formatCentsDisplay(totalCents)}</span>
              <button className={styles.activateBtn} onClick={handleBuy} disabled={buying}>
                {buying ? <span className={styles.spinner} /> : <Sparkles size={14} />}
                {buying ? t('addons.featuredPosts.buying') : t('addons.featuredPosts.buyBtn')}
              </button>
            </div>
            {error && <p className={styles.promoError}>{error}</p>}
          </div>
        )}
      </div>
    </motion.div>
  )
}
