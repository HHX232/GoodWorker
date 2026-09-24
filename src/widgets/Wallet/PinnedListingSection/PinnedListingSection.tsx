'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import { useVipTopUpPresets } from '../useVipTopUpPresets'
import { notifyWalletChanged } from '../walletEvents'
// Own module (ticket 05) — no longer shares vip.module.scss with the live
// /vip page, restyled to the wallet-a-3d.html dark 3D reference.
import styles from './PinnedListingSection.module.scss'

function dateLocaleFor(locale: string) {
  return locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : locale === 'hi' ? 'hi-IN' : 'en-US'
}

export function PinnedListingSection() {
  const t = useTranslations('vip')
  const tw = useTranslations('wallet')
  const locale = useLocale()
  const { pricing, balance, formatCentsDisplay, fetchBalance } = useVipTopUpPresets()
  // Slider position is the INDEX into pricing.pinnedListingTiers, not months
  // directly — tiers aren't evenly spaced (1,2,3,6,12), so a linear months
  // scale would either skip real tariffs or land on non-existent ones (R19).
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')

  if (!pricing) return null

  const activeUntil = balance?.pinnedInListUntil ? new Date(balance.pinnedInListUntil) : null
  const isActive = activeUntil !== null && activeUntil > new Date()
  const tiers = pricing.pinnedListingTiers
  const bestMonths = tiers.length ? tiers[tiers.length - 1].months : null
  const clampedIndex = Math.min(selectedIndex, Math.max(0, tiers.length - 1))
  const selectedTier = tiers[clampedIndex] ?? null

  const handleBuy = async () => {
    if (!selectedTier) return
    setBuying(true)
    setError('')
    try {
      const res = await fetch('/api/wallet/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'PINNED_LISTING', months: selectedTier.months }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error === 'INSUFFICIENT_BALANCE' ? t('addons.insufficientBalance') : t('addons.purchaseFailed'))
        return
      }
      toast.success(t('addons.purchaseSuccess'))
      fetchBalance()
      notifyWalletChanged()
    } catch {
      setError(t('addons.purchaseFailed'))
    } finally {
      setBuying(false)
    }
  }

  return (
    <section>
      <p className={styles.sectionLabel}>{t('addons.sectionLabel')}</p>
      <motion.div
        className={styles.getCard}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.getCardHeader}>
          <div className={styles.getCardNum}><Star size={14} fill="currentColor" /></div>
          <div>
            <span className={styles.addonEyebrow}>{t('addons.pinnedListing.eyebrow')}</span>
            <p className={styles.getCardTitle}>{t('addons.pinnedListing.title')}</p>
            <p className={styles.getCardSub}>{t('addons.pinnedListing.desc')}</p>
          </div>
        </div>
        <div className={styles.getCardBody}>
          {isActive && (
            <p className={styles.customPreview}>
              {t('addons.pinnedListing.activeUntil', { date: activeUntil!.toLocaleDateString(dateLocaleFor(locale)) })}
            </p>
          )}

          <div className={styles.sliderBlock}>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min={0}
                max={Math.max(0, tiers.length - 1)}
                step={1}
                value={clampedIndex}
                onChange={e => setSelectedIndex(Number(e.target.value))}
                aria-label={t('addons.pinnedListing.title')}
              />
              <span className={styles.sliderValue}>
                {selectedTier ? t('addons.monthsCount', { count: selectedTier.months }) : ''}
              </span>
            </div>

            <div className={styles.tierTicks} aria-hidden="true">
              {tiers.map((tier, i) => (
                <span
                  key={tier.months}
                  className={`${styles.tierTick} ${i === clampedIndex ? styles.tierTickActive : ''} ${tier.months === bestMonths ? styles.tierTickBest : ''}`}
                >
                  {tier.months === bestMonths && <span className={styles.presetBadge}>{tw('topup.bestValue')}</span>}
                  {tier.months}
                </span>
              ))}
            </div>

            <div className={styles.priceRow}>
              <span className={styles.priceDisplay}>
                {selectedTier?.oldPriceCents !== undefined && (
                  <span className={styles.oldPrice}>{formatCentsDisplay(selectedTier.oldPriceCents)}</span>
                )}
                {selectedTier ? formatCentsDisplay(selectedTier.priceCents) : ''}
              </span>
              <button className={styles.payBtn} onClick={handleBuy} disabled={buying || !selectedTier}>
                {buying ? <span className={styles.spinner} /> : <Star size={14} fill="currentColor" />}
                {buying
                  ? t('addons.featuredPosts.buying')
                  : `${t('addons.pinnedListing.buyBtn')} · ${selectedTier ? formatCentsDisplay(selectedTier.priceCents) : ''}`}
              </button>
            </div>
          </div>
          {error && <p className={styles.promoError}>{error}</p>}
        </div>
      </motion.div>
    </section>
  )
}
