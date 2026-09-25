'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import {
  FolderOpen,
  Tag, Video, FileText, FileUp, MessageSquare,
  Star, ArrowRight, CheckCircle, Zap, Users, BookOpen, X, Copy, Gift, Wallet, CreditCard, Sparkles,
  QrCode, Landmark, ShoppingBag,
} from 'lucide-react'
import Link from 'next/link'
import { useVipTopUpPresets } from '@/widgets/Wallet/useVipTopUpPresets'
import { notifyWalletChanged } from '@/widgets/Wallet/walletEvents'
import { FeaturedPostsAddon } from '@/widgets/Wallet/FeaturedPostsAddon/FeaturedPostsAddon'
import { PinnedListingSection } from '@/widgets/Wallet/PinnedListingSection/PinnedListingSection'
import styles from './vip.module.scss'

// ── Starfield ──────────────────────────────────────────────

function makeStars() {
  return Array.from({ length: 80 }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: 1 + Math.random() * 2,
    delay: Math.random() * 6,
    dur: 2.5 + Math.random() * 3,
  }))
}

function Starfield() {
  // Random star positions can't be rendered during SSR without mismatching what the client
  // re-generates on hydration — render nothing until mounted, then fill in client-side.
  const [stars, setStars] = useState<ReturnType<typeof makeStars>>([])
  useEffect(() => { setStars(makeStars()) }, [])

  return (
    <div className={styles.starfield} aria-hidden>
      {stars.map(s => (
        <motion.div
          key={s.id}
          style={{
            position: 'absolute',
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: '#fff',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ── Features (icon/color stay in code — one row per messages.vip.features[i]) ──

const FEATURES_META = [
  { icon: <Video size={18} />, bg: '#eff6ff', color: '#2563eb' },
  { icon: <Tag size={18} />, bg: '#f0fdf4', color: '#16a34a' },
  { icon: <FileText size={18} />, bg: '#fdf4ff', color: '#9333ea' },
  { icon: <FileUp size={18} />, bg: '#fff7ed', color: '#ea580c' },
  { icon: <Zap size={18} />, bg: '#fefce8', color: '#ca8a04' },
  { icon: <Star size={18} />, bg: '#fdf2f8', color: '#db2777' },
  { icon: <Users size={18} />, bg: '#f0fdfa', color: '#0d9488' },
  { icon: <BookOpen size={18} />, bg: '#f8fafc', color: '#475569' },
  { icon: <MessageSquare size={18} />, bg: '#fff1f2', color: '#e11d48' },
]

interface VipFeatureText { title: string; desc: string; tag: string | null }

/** The file library is VIP-only — the lead feature, full row, with the live quota from the admin setting. */
function StorageFeatureCard() {
  const t = useTranslations('vip.storage')
  const [quotaGb, setQuotaGb] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/tutor-files/limits')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.quotaGb === 'number') setQuotaGb(d.quotaGb) })
      .catch(() => {})
  }, [])
  return (
    <motion.div
      className={`${styles.featureCard} ${styles.featureCardWide}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.featureIcon} style={{ background: '#EEEDFE', color: '#534AB7' }}>
        <FolderOpen size={18} />
      </div>
      <div className={styles.featureWideBody}>
        <h3 className={styles.featureTitle}>{t('title')}</h3>
        <p className={styles.featureDesc}>{t('desc')}</p>
        <div className={styles.featureWideTags}>
          <span className={styles.featureTag} style={{ background: '#EEEDFE', color: '#534AB7' }}>{t('tag')}</span>
          {quotaGb !== null && <span className={styles.featureTag} style={{ background: '#E1F5EE', color: '#0F6E56' }}>{t('quota', { gb: quotaGb })}</span>}
        </div>
      </div>
      <Link href="/files" className={styles.featureWideLink}>{t('open')}</Link>
    </motion.div>
  )
}

// ── Errors ─────────────────────────────────────────────────

const PROMO_ERROR_KEYS = ['INVALID_PROMO', 'PROMO_EXPIRED', 'PROMO_EXHAUSTED', 'ALREADY_USED'] as const

// ── Promo activation form (shared between the inline "How to get VIP" card and the buy modal) ──

interface PromoFormProps {
  activated: boolean
  vipUntil: string | null
  promoCode: string
  setPromoCode: (v: string) => void
  promoError: string
  setPromoError: (v: string) => void
  loading: boolean
  onActivate: () => void
}

function PromoForm({ activated, vipUntil, promoCode, setPromoCode, promoError, setPromoError, loading, onActivate }: PromoFormProps) {
  const t = useTranslations('vip')
  if (activated) {
    return (
      <div className={styles.successBlock}>
        <div className={styles.successIconWrap}>
          <CheckCircle size={20} />
        </div>
        <div>
          <div className={styles.successTitle}>{t('promo.activated')}</div>
          {vipUntil && <div className={styles.successSub}>{t('promo.validUntil', { date: vipUntil })}</div>}
        </div>
        <Link href="/create-road-map" className={styles.goBtn}>
          {t('promo.createCourse')}
          <ArrowRight size={13} />
        </Link>
      </div>
    )
  }
  return (
    <>
      <div className={styles.promoRow}>
        <div className={styles.promoInputWrap}>
          <span className={styles.promoIconWrap}>
            <Tag size={14} />
          </span>
          <input
            className={`${styles.promoInput} ${promoError ? styles.promoInputError : ''}`}
            type="text"
            aria-label={t('promo.codeAria')}
            aria-invalid={!!promoError}
            placeholder={t('promo.codePlaceholder')}
            value={promoCode}
            onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
            onKeyDown={e => e.key === 'Enter' && onActivate()}
            maxLength={32}
          />
        </div>
        <button className={styles.activateBtn} onClick={onActivate} disabled={loading}>
          {loading ? <span className={styles.spinner} /> : <Star size={14} />}
          {loading ? t('promo.activating') : t('promo.activateBtn')}
        </button>
      </div>
      {promoError && <p className={styles.promoError}>{promoError}</p>}
      <p className={styles.promoHint}>{t('promo.caseHint')}</p>
    </>
  )
}

// ── Referral card (invite friends → free VIP for both sides) ──

interface ReferralData {
  link: string
  rewardDays: number
  isUnlimited: boolean
  maxFreeInvites: number
  invitesUsed: number
  remaining: number | null
}

function ReferralCard() {
  const t = useTranslations('vip')
  const { status } = useSession()
  const [data, setData] = useState<ReferralData | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    fetch('/api/referral/me')
      .then(res => { if (!res.ok) throw new Error('failed'); return res.json() })
      .then(json => { if (!cancelled) setData(json) })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [status])

  async function handleCopy() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.link)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = data.link
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    toast.success(t('referral.copiedToast'))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      id="referral-card"
      className={styles.getCard}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.05 }}
    >
      <div className={styles.getCardHeader}>
        <div className={styles.getCardNum}><Gift size={14} /></div>
        <div>
          <p className={styles.getCardTitle}>{t('referral.title')}</p>
          <p className={styles.getCardSub}>
            {status === 'authenticated' && data
              ? t('referral.subWithReward', { days: data.rewardDays })
              : t('referral.subDefault')}
          </p>
        </div>
      </div>
      <div className={styles.getCardBody}>
        {status === 'loading' && <p className={styles.promoHint}>{t('referral.loading')}</p>}

        {status === 'unauthenticated' && (
          <p className={styles.promoHint}>
            {t.rich('referral.loginToGetLink', { a: chunks => <Link href="/login" className={styles.freeHintLink}>{chunks}</Link> })}
          </p>
        )}

        {status === 'authenticated' && loadFailed && (
          <p className={styles.promoError}>{t('referral.loadFailed')}</p>
        )}

        {status === 'authenticated' && data && (
          <>
            <div className={styles.promoRow}>
              <div className={styles.promoInputWrap}>
                <span className={styles.promoIconWrap}>
                  <Users size={14} />
                </span>
                <input
                  className={styles.promoInput}
                  type="text"
                  aria-label={t('referral.linkAria')}
                  readOnly
                  value={data.link}
                  onFocus={e => e.currentTarget.select()}
                />
              </div>
              <button className={styles.activateBtn} onClick={handleCopy}>
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? t('referral.copiedBtn') : t('referral.copyBtn')}
              </button>
            </div>
            <p className={styles.promoHint}>
              {data.isUnlimited
                ? t('referral.invitedUnlimited', { count: data.invitesUsed })
                : t('referral.invitedWithLimit', { count: data.invitesUsed, max: data.maxFreeInvites })}
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ── Top-up section (deposit funds AI-фичи; bigger amounts grant a better VIP rate) ──

const TOPUP_STEP_ICONS = [<Wallet key="0" size={16} />, <Gift key="1" size={16} />, <Sparkles key="2" size={16} />]

function TopUpSection({ onOpenPayment }: { onOpenPayment: (amountCents: number) => void }) {
  const { status } = useSession()
  const t = useTranslations('wallet')
  const tv = useTranslations('vip')
  const { isByn, balance, balanceLoading, pricing, formatCentsDisplay, parseDisplayToCents, monthsFor } = useVipTopUpPresets()
  const [showCustom, setShowCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [customError, setCustomError] = useState('')

  const tiers = pricing?.vipBonusTiers ?? []
  const bestMinCents = tiers.length ? tiers[tiers.length - 1].minAmountCents : null
  const steps = tv.raw('steps') as { title: string; desc: string }[]

  const handleCustomContinue = () => {
    const cents = parseDisplayToCents(customValue)
    if (!pricing || cents === null || cents < pricing.minDepositCents || cents > pricing.maxDepositCents) {
      const min = pricing ? formatCentsDisplay(pricing.minDepositCents) : '$1'
      const max = pricing ? formatCentsDisplay(pricing.maxDepositCents) : '$1000'
      setCustomError(t('topup.invalidAmount', { min, max }))
      return
    }
    setCustomError('')
    onOpenPayment(cents)
  }

  return (
    <section id="topup-section">
      <p className={styles.sectionLabel}>{tv('mechanic.sectionLabel')}</p>

      <motion.div
        className={styles.mechanicBanner}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.mechanicIconWrap}>
          <Gift size={20} />
        </div>
        <div>
          <p className={styles.mechanicTitle}>{tv('mechanic.title')}</p>
          <p className={styles.mechanicSub}>{tv('mechanic.sub')}</p>
        </div>
      </motion.div>

      <motion.div
        className={styles.getCard}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className={styles.getCardHeader}>
          <div className={styles.getCardNum}><CreditCard size={14} /></div>
          <div>
            <p className={styles.getCardTitle}>{t('topup.chooseAmount')}</p>
            <p className={styles.getCardSub}>
              {status === 'authenticated'
                ? <>{t('currentBalance')}: <strong>{balanceLoading ? '…' : formatCentsDisplay(balance?.balanceCents ?? 0)}</strong></>
                : tv.rich('topupLoginHint', { a: chunks => <Link href="/login" className={styles.freeHintLink}>{chunks}</Link> })}
            </p>
          </div>
        </div>
        <div className={styles.getCardBody}>
          {status === 'unauthenticated' ? null : !pricing ? (
            <p className={styles.promoHint}>{t('history.loading')}</p>
          ) : (
            <>
              <div className={styles.presetGrid}>
                {tiers.map(tier => (
                  <button
                    key={tier.minAmountCents}
                    className={`${styles.presetCard} ${tier.minAmountCents === bestMinCents ? styles.presetCardBest : ''}`}
                    onClick={() => onOpenPayment(tier.minAmountCents)}
                  >
                    {tier.minAmountCents === bestMinCents && <span className={styles.presetBadge}>{t('topup.bestValue')}</span>}
                    <span className={styles.presetAmount}>{formatCentsDisplay(tier.minAmountCents)}</span>
                    <span className={styles.presetMonths}>→ {t('topup.vipMonths', { count: monthsFor(tier.minAmountCents) })}</span>
                  </button>
                ))}
                <button
                  className={`${styles.presetCard} ${styles.presetCardCustom} ${showCustom ? styles.presetCardCustomActive : ''}`}
                  onClick={() => setShowCustom(true)}
                >
                  <Sparkles size={18} />
                  <span className={styles.presetAmount}>{t('topup.custom')}</span>
                </button>
              </div>

              {showCustom && (
                <div style={{ marginBottom: 12 }}>
                  <div className={styles.promoRow}>
                    <div className={styles.promoInputWrap}>
                      <span className={styles.promoIconWrap}>{isByn ? 'Br' : '$'}</span>
                      <input
                        className={`${styles.promoInput} ${customError ? styles.promoInputError : ''}`}
                        type="number"
                        inputMode="decimal"
                        placeholder={t('topup.customPlaceholder')}
                        aria-label={t('topup.custom')}
                        value={customValue}
                        onChange={e => { setCustomValue(e.target.value); setCustomError('') }}
                        onKeyDown={e => e.key === 'Enter' && handleCustomContinue()}
                        autoFocus
                      />
                    </div>
                    <button className={styles.activateBtn} onClick={handleCustomContinue}>
                      {t('topup.continue')}
                    </button>
                  </div>
                  {customError && <p className={styles.promoError}>{customError}</p>}
                  {!customError && customValue && parseDisplayToCents(customValue) !== null && (
                    <p className={styles.customPreview}>→ {t('topup.vipMonths', { count: monthsFor(parseDisplayToCents(customValue)!) })}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      <div className={styles.topupSteps}>
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            className={styles.topupStepCard}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <div className={styles.getCardNum}>{TOPUP_STEP_ICONS[i]}</div>
            <div>
              <h3 className={styles.featureTitle}>{s.title}</h3>
              <p className={styles.featureDesc}>{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ── Payment method modal (mock checkout: amount + months are already
// decided by the caller; picking a method is cosmetic, the actual submit
// still goes through the same mock /api/wallet/topup as before) ──

const PAYMENT_METHODS_BYN = [
  { id: 'card', icon: <CreditCard size={18} />, labelKey: 'topup.methodCard' as const },
  { id: 'erip', icon: <Landmark size={18} />, labelKey: 'topup.methodErip' as const },
  { id: 'qr', icon: <QrCode size={18} />, labelKey: 'topup.methodQr' as const },
]
const PAYMENT_METHODS_USD = [
  { id: 'card', icon: <CreditCard size={18} />, labelKey: 'topup.methodCard' as const },
  { id: 'paypal', icon: <ShoppingBag size={18} />, labelKey: 'topup.methodPaypal' as const },
  { id: 'wallet', icon: <Wallet size={18} />, labelKey: 'topup.methodWallet' as const },
]

function TopUpPaymentModal({ amountCents, onClose, onSuccess }: {
  amountCents: number | null
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations('wallet')
  const tv = useTranslations('vip')
  const { isByn, formatCentsDisplay, monthsFor } = useVipTopUpPresets()
  const [method, setMethod] = useState('card')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (amountCents === null) return
    setMethod('card')
    setSubmitting(false)
    setError('')
    setSuccess(null)
  }, [amountCents])

  useEffect(() => {
    if (amountCents === null) return
    function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeydown)
    document.body.style.setProperty('overflow', 'hidden', 'important')
    return () => {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.removeProperty('overflow')
    }
  }, [amountCents, onClose])

  if (amountCents === null) return null

  const methods = isByn ? PAYMENT_METHODS_BYN : PAYMENT_METHODS_USD
  const months = monthsFor(amountCents)

  const handlePay = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || t('form.genericError')); return }
      setSuccess(
        data.vipMonthsGranted > 0
          ? t('form.successWithVip', { amount: formatCentsDisplay(amountCents), months: data.vipMonthsGranted })
          : t('form.success', { amount: formatCentsDisplay(amountCents) }),
      )
      toast.success(t('form.success', { amount: formatCentsDisplay(amountCents) }))
      notifyWalletChanged()
      onSuccess()
    } catch {
      setError(t('form.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.buyModalBackdrop} onClick={onClose}>
      <motion.div
        className={styles.buyModalCard}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('topup.modalTitle')}
      >
        <button className={styles.buyModalClose} onClick={onClose} aria-label={tv('modal.close')}>
          <X size={16} />
        </button>
        <div className={styles.buyModalHeader}>
          <div className={styles.getCardNum}><Wallet size={14} /></div>
          <div>
            <p className={styles.getCardTitle}>{t('topup.modalTitle')}</p>
            <p className={styles.getCardSub}>{tv('modal.mockNote')}</p>
          </div>
        </div>

        {success ? (
          <div className={styles.successBlock}>
            <div className={styles.successIconWrap}><CheckCircle size={20} /></div>
            <div>
              <div className={styles.successTitle}>{tv('modal.done')}</div>
              <div className={styles.successSub}>{success}</div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.modalSummary}>
              <span className={styles.modalSummaryAmount}>{formatCentsDisplay(amountCents)}</span>
              {months > 0 && <span className={styles.modalSummaryMonths}>→ {t('topup.vipMonths', { count: months })}</span>}
            </div>

            <p className={styles.methodLabel}>{t('topup.methodLabel')}</p>
            <div className={styles.methodGrid}>
              {methods.map(m => (
                <button
                  key={m.id}
                  className={`${styles.methodCard} ${method === m.id ? styles.methodCardSelected : ''}`}
                  onClick={() => setMethod(m.id)}
                >
                  {m.icon}
                  {t(m.labelKey)}
                </button>
              ))}
            </div>

            {error && <p className={styles.promoError} style={{ marginBottom: 10 }}>{error}</p>}

            <button className={styles.payBtn} onClick={handlePay} disabled={submitting}>
              {submitting ? <span className={styles.spinner} /> : <Wallet size={15} />}
              {submitting ? t('topup.paying') : t('topup.payBtn', { amount: formatCentsDisplay(amountCents) })}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}

// FeaturedPostsAddon / PinnedListingSection moved to src/widgets/Wallet/ so
// /wallet can render them too (imported above) — both debit the same wallet
// balance as the VIP top-up above, teacher-only (students have neither posts
// nor a tutor listing).

function dateLocaleFor(locale: string) {
  return locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : locale === 'hi' ? 'hi-IN' : 'en-US'
}

// ── Page ───────────────────────────────────────────────────

export default function VipClientPage() {

  useEffect(() => {
    document.body.style.setProperty('overflow', 'auto', 'important')
    document.documentElement.classList.add('vip-dark')
    return () => {
      document.body.style.removeProperty('overflow')
      document.documentElement.classList.remove('vip-dark')
    }
  }, [])

  const t = useTranslations('vip')
  const locale = useLocale()
  const dateLocale = dateLocaleFor(locale)
  const { data: session } = useSession()
  const sessionRole = (session?.user as { role?: string } | undefined)?.role
  const isTeacher = sessionRole === 'TEACHER' || sessionRole === 'ADMIN'

  const [paymentAmountCents, setPaymentAmountCents] = useState<number | null>(null)
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activated, setActivated] = useState(false)
  const [vipUntil, setVipUntil] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoError, setPromoError] = useState('')

  const handleActivate = async () => {
    setPromoError('')
    if (!promoCode.trim()) {
      setPromoError(t('promo.enterCode'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/teacher/vip/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        if ((PROMO_ERROR_KEYS as readonly string[]).includes(data.error)) {
          setPromoError(t(`errors.${data.error}` as Parameters<typeof t>[0]))
          return
        }
        if (data.error === 'Unauthorized') {
          toast.error(t('promo.loginToActivate'))
          return
        }
        throw new Error(data.error)
      }

      setActivated(true)
      setVipUntil(data.vipUntil ? new Date(data.vipUntil).toLocaleDateString(dateLocale) : null)
      toast.success(data.promoDescription ? `🎉 ${data.promoDescription}` : t('promo.activated'))
    } catch {
      toast.error(t('promo.activateFailed'))
    } finally {
      setLoading(false)
    }
  }

  const features = t.raw('features') as VipFeatureText[]

  return (
    <main className={styles.page}>
      <Starfield />

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={styles.heroBadge}
        >
          <Star size={11} fill="currentColor" />
          {t('hero.badge')}
        </motion.div>

        <motion.div
          className={styles.heroLinks}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <a href="#features-section" className={styles.heroLink}>
            {t('featuresAnchor')}
          </a>
          <a href="#referral-card" className={styles.heroFreeBtn}>
            <Gift size={13} />
            {t('hero.freeBtn')}
          </a>
        </motion.div>
      </section>

      <div className={styles.content}>

        {/* ── Top-up (balance → VIP bonus) ── */}
        <TopUpSection key={balanceRefreshKey} onOpenPayment={setPaymentAmountCents} />

        {/* ── Teacher add-ons: pinned listing (full block) + featured posts (compact) ── */}
        {isTeacher && (
          <>
            <PinnedListingSection key={`pinned-${balanceRefreshKey}`} />
            <section id="featured-posts-section">
              <FeaturedPostsAddon key={`featured-${balanceRefreshKey}`} />
            </section>
          </>
        )}

        {/* ── Features ── */}
        <section id="features-section">
          <p className={styles.sectionLabel}>{t('featuresLabel')}</p>
          <div className={styles.grid}>
            <StorageFeatureCard />
            {FEATURES_META.map((meta, i) => {
              const f = features[i]
              return (
              <motion.div
                key={f.title}
                className={styles.featureCard}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <div className={styles.featureIcon} style={{ background: meta.bg, color: meta.color }}>
                  {meta.icon}
                </div>
                <div>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureDesc}>{f.desc}</p>
                  {f.tag && (
                    <span
                      className={styles.featureTag}
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {f.tag}
                    </span>
                  )}
                </div>
              </motion.div>
              )
            })}
          </div>
        </section>

        {/* ── How to get VIP ── */}
        <section>
          <p className={styles.sectionLabel}>{t('getVip.sectionLabel')}</p>
          <div className={styles.getSection}>

            {/* Promo code card */}
            <motion.div
              className={styles.getCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <div className={styles.getCardHeader}>
                <div className={styles.getCardNum}>1</div>
                <div>
                  <p className={styles.getCardTitle}>{t('getVip.promoCardTitle')}</p>
                  <p className={styles.getCardSub}>{t('getVip.promoCardSub')}</p>
                </div>
              </div>
              <div className={styles.getCardBody}>
                <PromoForm
                  activated={activated}
                  vipUntil={vipUntil}
                  promoCode={promoCode}
                  setPromoCode={setPromoCode}
                  promoError={promoError}
                  setPromoError={setPromoError}
                  loading={loading}
                  onActivate={handleActivate}
                />
              </div>
            </motion.div>

            <ReferralCard />

            {/* Free hint: first feedback */}
            <motion.div
              className={styles.freeHintCard}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className={styles.freeHintIcon}>
                <MessageSquare size={17} />
              </div>
              <div className={styles.freeHintText}>
                <p>{t.rich('getVip.feedbackHint', { b: chunks => <strong>{chunks}</strong> })}</p>
                <Link href="/feedback" className={styles.freeHintLink}>
                  {t('getVip.feedbackLink')}
                  <ArrowRight size={12} />
                </Link>
              </div>
            </motion.div>

          </div>
        </section>

      </div>

      <TopUpPaymentModal
        amountCents={paymentAmountCents}
        onClose={() => setPaymentAmountCents(null)}
        onSuccess={() => setBalanceRefreshKey(k => k + 1)}
      />
    </main>
  )
}
