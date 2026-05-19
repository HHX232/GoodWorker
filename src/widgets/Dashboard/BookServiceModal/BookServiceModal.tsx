'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import styles from './BookServiceModal.module.scss'

interface ServiceInfo {
  id: string
  title: string
  duration: number
  timeFrom: string
  timeTo: string
  isGroup: boolean
  price: number
}

interface Props {
  open: boolean
  onClose: () => void
  service: ServiceInfo | null
}

function fmtDuration(mins: number, minUnit: string, hourUnit: string): string {
  if (mins < 60) return `${mins} ${minUnit}`
  const h = mins / 60
  return `${h} ${hourUnit}`
}

function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconGroup() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconPerson() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function BookServiceModal({ open, onClose, service }: Props) {
  const t = useTranslations('dashboard.bookService')
  const [promoInput, setPromoInput] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [promoError, setPromoError] = useState('')
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setPromoInput(''); setPromoApplied(false); setDiscount(0)
      setPromoError(''); setError(''); setSuccess(false)
    }
  }, [open])

  if (!open || !service) return null

  const basePrice = service.price
  const finalPrice = promoApplied ? basePrice * (1 - discount / 100) : basePrice

  async function applyPromo() {
    if (!promoInput.trim()) return
    setApplyingPromo(true)
    setPromoError('')
    try {
      const res = await fetch(`/api/services/${service!.id}/promo-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setPromoError(data.error ?? t('promoNotFound')); return }
      setDiscount(data.discount)
      setPromoApplied(true)
    } catch {
      setPromoError(t('errorNetwork'))
    } finally {
      setApplyingPromo(false)
    }
  }

  async function handleBook() {
    setSubmitting(true)
    setError('')
    const tid = toast.loading('Оформление записи...')
    try {
      const res = await fetch(`/api/services/${service!.id}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoApplied ? promoInput.trim().toUpperCase() : undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? t('errorBook')
        setError(msg)
        toast.error(msg, { id: tid })
        return
      }
      toast.success('Запись оформлена!', { id: tid })
      setSuccess(true)
    } catch {
      setError(t('errorNetwork'))
      toast.error('Ошибка соединения. Попробуйте ещё раз.', { id: tid })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <h2 className={styles.heading}>{t('heading')}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('close')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className={styles.successWrap}>
            <div className={styles.successIcon}><IconCheck /></div>
            <h3 className={styles.successTitle}>{t('successTitle')}</h3>
            <p className={styles.successDesc}>
              {t('successDesc')}
            </p>
            <button className={styles.doneBtn} onClick={onClose}>{t('done')}</button>
          </div>
        ) : (
          <>
            <div className={styles.body}>
              {/* Service info */}
              <div className={styles.serviceInfo}>
                <div className={styles.serviceTitle}>{service.title}</div>
                <div className={styles.serviceMeta}>
                  <span className={styles.metaBadge}>
                    <IconClock /> {fmtDuration(service.duration, t('minUnit'), t('hourUnit'))}
                  </span>
                  <span className={styles.metaBadge}>
                    {service.isGroup ? <IconGroup /> : <IconPerson />}
                    {service.isGroup ? t('group') : t('personal')}
                  </span>
                  <span className={styles.metaBadge}>{service.timeFrom}–{service.timeTo}</span>
                </div>
                <div className={styles.priceRow}>
                  {promoApplied ? (
                    <>
                      <span className={styles.priceFinal}>{Math.round(finalPrice).toLocaleString('ru-RU')} ₽</span>
                      <span className={styles.priceOld}>{basePrice.toLocaleString('ru-RU')} ₽</span>
                      <span className={styles.discountBadge}>−{discount}%</span>
                    </>
                  ) : (
                    <span className={styles.priceBase}>{basePrice.toLocaleString('ru-RU')} ₽</span>
                  )}
                </div>
              </div>

              {/* Promo code */}
              <div className={styles.field}>
                <label className={styles.label}>{t('promoLabel')}</label>
                {promoApplied ? (
                  <div className={styles.promoSuccess}>{t('promoApplied', {code: promoInput.toUpperCase(), discount})}</div>
                ) : (
                  <div className={styles.promoRow}>
                    <input
                      className={styles.input}
                      type="text"
                      value={promoInput}
                      onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError('') }}
                      placeholder="SUMMER20"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      className={styles.applyBtn}
                      onClick={applyPromo}
                      disabled={applyingPromo || !promoInput.trim()}
                    >
                      {applyingPromo ? '...' : t('promoApply')}
                    </button>
                  </div>
                )}
                {promoError && <div className={styles.error}>{promoError}</div>}
              </div>

              {error && <div className={styles.error}>{error}</div>}
            </div>

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose} disabled={submitting}>{t('cancel')}</button>
              <button className={styles.submitBtn} onClick={handleBook} disabled={submitting}>
                {submitting ? t('booking') : t('bookFor', {price: Math.round(finalPrice).toLocaleString()})}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
