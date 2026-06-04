'use client'
import RoadmapService from '@/features/services/RoadmapService.service'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import styles from './PurchaseAccessModal.module.scss'

interface Props {
  isOpen: boolean
  onClose: () => void
  roadmapId: string
  price: number
  title: string
}

export function PurchaseAccessModal({ isOpen, onClose, roadmapId, price, title }: Props) {
  const t = useTranslations('PurchaseAccessModal')
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const handlePurchase = async () => {
    setLoading(true)
    try {
      await RoadmapService.purchaseAccess(roadmapId)
      await queryClient.invalidateQueries({ queryKey: ['roadmapAccess', roadmapId] })
      toast.success(t('success'))
      onClose()
    } catch {
      toast.error(t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={<span style={{ fontWeight: 700, fontSize: 16 }}>{t('title')}</span>}
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.cancel_btn} onClick={onClose} disabled={loading}>
            {t('cancel')}
          </button>
          <button className={styles.buy_btn} onClick={handlePurchase} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : null}
            {loading ? t('processing') : `${t('buyBtn')}${price > 0 ? ` · ${price} ₽` : ''}`}
          </button>
        </div>
      }
    >
      <div className={styles.content}>
        <div className={styles.icon_wrap}>
          <svg width='28' height='28' viewBox='0 0 24 24' fill='none'>
            <rect x='3' y='11' width='18' height='11' rx='2' stroke='#534AB7' strokeWidth='1.6' />
            <path d='M7 11V7a5 5 0 0 1 10 0v4' stroke='#534AB7' strokeWidth='1.6' strokeLinecap='round' />
          </svg>
        </div>
        <div className={styles.info}>
          <p className={styles.roadmap_title}>{title}</p>
          <p className={styles.desc}>{t('desc')}</p>
          {price > 0 && (
            <div className={styles.price_row}>
              <span className={styles.price_label}>{t('priceLabel')}</span>
              <span className={styles.price_value}>{price} ₽</span>
            </div>
          )}
          <p className={styles.stub_notice}>{t('stub')}</p>
        </div>
      </div>
    </ModalWindowDefault>
  )
}
