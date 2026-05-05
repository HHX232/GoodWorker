'use client'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { FEATURED_CURRENCIES, formatConverted } from '@/shared/utils/currencyConverter'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './PublishModal.module.scss'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (price: number) => void
}

export function PublishModal({ isOpen, onClose, onConfirm }: Props) {
  const t = useTranslations('roadMap')
  const router = useRouter()
  const [priceInput, setPriceInput] = useState('')
  const [isVip, setIsVip] = useState<boolean | null>(null)
  const [vipLoading, setVipLoading] = useState(false)

  const priceNum = Math.max(0, parseFloat(priceInput) || 0)
  const isPaid = priceNum > 0

  // Fetch VIP status when modal opens
  useEffect(() => {
    if (!isOpen) return
    setPriceInput('')
    setIsVip(null)
    setVipLoading(true)
    fetch('/api/teacher/vip')
      .then((r) => r.json())
      .then((d) => setIsVip(d.isVip ?? false))
      .catch(() => setIsVip(false))
      .finally(() => setVipLoading(false))
  }, [isOpen])

  const canConfirm = !isPaid || (isVip === true)

  const handleConfirm = () => {
    onConfirm(priceNum)
    onClose()
  }

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={<span style={{ fontWeight: 700, fontSize: 16 }}>{t('publishSettings')}</span>}
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.cancel_btn} onClick={onClose}>
            {t('publishCancel')}
          </button>
          <button
            className={styles.confirm_btn}
            onClick={handleConfirm}
            disabled={!canConfirm || vipLoading}
          >
            {t('publishConfirm')}
          </button>
        </div>
      }
    >
      <div className={styles.content}>
        {/* Price input */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#868897', marginBottom: 8 }}>
            {t('priceLabel')}
          </p>
          <div className={styles.price_row}>
            <input
              className={styles.price_input}
              type='number'
              min={0}
              step={1}
              placeholder='0'
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
            <span className={styles.currency_base}>₽</span>
            {!isPaid && <span className={styles.free_badge}>{t('priceFree')}</span>}
          </div>
        </div>

        {/* Currency grid — only when price > 0 */}
        {isPaid && (
          <div>
            <p className={styles.grid_label}>{t('currencyPreview')}</p>
            <div className={styles.currency_grid}>
              {FEATURED_CURRENCIES.map((cur) => (
                <div key={cur.code} className={styles.currency_cell}>
                  <span className={styles.cell_flag}>{cur.flag}</span>
                  <div className={styles.cell_body}>
                    <span className={styles.cell_code}>{cur.code}</span>
                    <span className={styles.cell_amount}>{formatConverted(priceNum, cur)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIP notice — only when price > 0 and not VIP */}
        {isPaid && !vipLoading && isVip === false && (
          <div className={styles.vip_notice}>
            <span className={styles.vip_icon}>👑</span>
            <div className={styles.vip_text}>
              <p className={styles.vip_title}>{t('vipRequired')}</p>
              <p className={styles.vip_desc}>{t('vipRequiredDesc')}</p>
              <button className={styles.vip_btn} onClick={() => { onClose(); router.push('/vip') }}>{t('purchaseVip')} →</button>
            </div>
          </div>
        )}

        {/* VIP loading */}
        {isPaid && vipLoading && (
          <p style={{ fontSize: 13, color: '#868897' }}>{t('vipChecking')}</p>
        )}
      </div>
    </ModalWindowDefault>
  )
}
