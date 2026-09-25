'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CheckCircle, CreditCard, Landmark, QrCode, ShoppingBag, Wallet, X } from 'lucide-react'
import { useVipTopUpPresets } from '../useVipTopUpPresets'
import { notifyWalletChanged } from '../walletEvents'
import styles from './TopUpPaymentModal.module.scss'

// Same payment step as TopUpPaymentModal on /vip (app/(road-map)/vip/VipClientPage.tsx):
// amount is decided by the caller, the method choice is cosmetic until a real
// provider exists — the submit goes through the same mock POST /api/wallet/topup.
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

export function TopUpPaymentModal({ amountCents, onClose, onSuccess }: {
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
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.card}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('topup.modalTitle')}
      >
        <button className={styles.close} onClick={onClose} aria-label={tv('modal.close')}>
          <X size={16} />
        </button>
        <div className={styles.header}>
          <div className={styles.headerIcon}><Wallet size={16} /></div>
          <div>
            <p className={styles.title}>{t('topup.modalTitle')}</p>
            <p className={styles.sub}>{tv('modal.mockNote')}</p>
          </div>
        </div>

        {success ? (
          <div className={styles.successBlock}>
            <CheckCircle size={22} />
            <div>
              <div className={styles.successTitle}>{tv('modal.done')}</div>
              <div className={styles.successSub}>{success}</div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <span className={styles.summaryLabel}>{t('topup.toPayLabel')}</span>
              <span className={styles.summaryAmount}>{formatCentsDisplay(amountCents)}</span>
              {months > 0 && (
                <span className={styles.summaryMonths}>{t('topup.vipBonusLabel')}: {t('topup.vipMonths', { count: months })}</span>
              )}
            </div>

            <p className={styles.methodLabel}>{t('topup.methodLabel')}</p>
            <div className={styles.methodGrid}>
              {methods.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.method} ${method === m.id ? styles.methodSelected : ''}`}
                  onClick={() => setMethod(m.id)}
                >
                  {m.icon}
                  {t(m.labelKey)}
                </button>
              ))}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="button" className={styles.payBtn} onClick={handlePay} disabled={submitting}>
              {submitting ? <span className={styles.spinner} /> : <Wallet size={15} />}
              {submitting ? t('topup.paying') : t('topup.payBtn', { amount: formatCentsDisplay(amountCents) })}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
