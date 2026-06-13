'use client'
import { RoadmapNodeAccessType } from '@/features/services/RoadmapService.service'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { CURRENCIES, FEATURED_CURRENCIES, formatConverted } from '@/shared/utils/currencyConverter'
import { FlagIcon } from '@/shared/ui/FlagIcon/FlagIcon'
import { CategorySelect } from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './PublishModal.module.scss'

type Step = 'access-type' | 'price'

interface Props {
  isOpen: boolean
  onClose: () => void
  hasPaywalledNodes: boolean
  initialCategoryIds?: string[]
  onConfirm: (price: number, nodeAccessType: RoadmapNodeAccessType | null, currency: string, categoryIds: string[]) => void
}

const ACCESS_OPTION_VALUES: { value: RoadmapNodeAccessType; labelKey: 'accessStudentsLabel' | 'accessSelectedLabel' | 'accessPurchaseLabel'; descKey: 'accessStudentsDesc' | 'accessSelectedDesc' | 'accessPurchaseDesc'; icon: React.ReactNode }[] = [
  {
    value: 'STUDENTS',
    labelKey: 'accessStudentsLabel',
    descKey: 'accessStudentsDesc',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <circle cx='9' cy='7' r='4' stroke='currentColor' strokeWidth='1.8' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      </svg>
    ),
  },
  {
    value: 'SELECTED',
    labelKey: 'accessSelectedLabel',
    descKey: 'accessSelectedDesc',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none'>
        <circle cx='12' cy='8' r='4' stroke='currentColor' strokeWidth='1.8' />
        <path d='M4 20c0-4 3.6-7 8-7s8 3 8 7' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M18 12l2 2 4-4' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    ),
  },
  {
    value: 'PURCHASE',
    labelKey: 'accessPurchaseLabel',
    descKey: 'accessPurchaseDesc',
    icon: (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none'>
        <rect x='2' y='7' width='20' height='14' rx='2' stroke='currentColor' strokeWidth='1.8' />
        <path d='M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2' stroke='currentColor' strokeWidth='1.8' />
        <line x1='12' y1='12' x2='12' y2='16' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <line x1='10' y1='14' x2='14' y2='14' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      </svg>
    ),
  },
]

export function PublishModal({ isOpen, onClose, hasPaywalledNodes, initialCategoryIds, onConfirm }: Props) {
  const t = useTranslations('roadMap')
  const router = useRouter()
  const [step, setStep] = useState<Step>(hasPaywalledNodes ? 'access-type' : 'price')
  const [selectedAccess, setSelectedAccess] = useState<RoadmapNodeAccessType | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [currency, setCurrency] = useState('BYN')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [isVip, setIsVip] = useState<boolean | null>(null)
  const [vipLoading, setVipLoading] = useState(false)

  const priceNum = Math.max(0, parseFloat(priceInput) || 0)
  const isPaid = priceNum > 0

  useEffect(() => {
    if (!isOpen) return
    setPriceInput('')
    setSelectedAccess(null)
    setCurrency('BYN')
    setStep(hasPaywalledNodes ? 'access-type' : 'price')
    setIsVip(null)
    if (initialCategoryIds && initialCategoryIds.length > 0) {
      setCategoryIds(initialCategoryIds)
    }
  }, [isOpen, hasPaywalledNodes])

  useEffect(() => {
    if (!isOpen || step !== 'price') return
    setVipLoading(true)
    fetch('/api/teacher/vip')
      .then((r) => r.json())
      .then((d) => setIsVip(d.isVip ?? false))
      .catch(() => setIsVip(false))
      .finally(() => setVipLoading(false))
  }, [isOpen, step])

  const canConfirmAccessType = selectedAccess !== null
  const canConfirmPrice = !isPaid || isVip === true

  const handleAccessNext = () => {
    if (selectedAccess === 'PURCHASE') {
      setStep('price')
    } else {
      onConfirm(0, selectedAccess, currency, categoryIds)
      onClose()
    }
  }

  const handlePublish = () => {
    onConfirm(priceNum, hasPaywalledNodes ? selectedAccess : null, currency, categoryIds)
    onClose()
  }

  const titleText = step === 'access-type' ? t('accessConditionTitle') : t('publishSettings')

  const footer =
    step === 'access-type' ? (
      <div className={styles.footer}>
        <button className={styles.cancel_btn} onClick={onClose}>
          {t('publishCancel')}
        </button>
        <button
          className={styles.confirm_btn}
          onClick={handleAccessNext}
          disabled={!canConfirmAccessType}
        >
          {selectedAccess === 'PURCHASE' ? t('publishNext') : t('publishConfirm')}
        </button>
      </div>
    ) : (
      <div className={styles.footer}>
        {hasPaywalledNodes && (
          <button className={styles.cancel_btn} onClick={() => setStep('access-type')}>
            {t('publishBack')}
          </button>
        )}
        {!hasPaywalledNodes && (
          <button className={styles.cancel_btn} onClick={onClose}>
            {t('publishCancel')}
          </button>
        )}
        <button
          className={styles.confirm_btn}
          onClick={handlePublish}
          disabled={!canConfirmPrice || vipLoading}
        >
          {t('publishConfirm')}
        </button>
      </div>
    )

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={<span style={{ fontWeight: 700, fontSize: 16 }}>{titleText}</span>}
      modalFooter={footer}
    >
      {step === 'access-type' ? (
        <div className={styles.content}>
          <p className={styles.access_hint}>{t('accessHint')}</p>
          <div className={styles.access_options}>
            {ACCESS_OPTION_VALUES.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.access_option} ${selectedAccess === opt.value ? styles.selected : ''}`}
                onClick={() => setSelectedAccess(opt.value)}
              >
                <span className={styles.opt_icon}>{opt.icon}</span>
                <span className={styles.opt_body}>
                  <span className={styles.opt_label}>{t(opt.labelKey)}</span>
                  <span className={styles.opt_desc}>{t(opt.descKey)}</span>
                </span>
                {opt.value === 'SELECTED' && (
                  <span className={styles.stub_tag}>{t('accessSoon')}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.content}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#868897', marginBottom: 8 }}>
              {t('categoryLabel') || 'Категории'}
            </p>
            <CategorySelect
              value={categoryIds}
              onChange={setCategoryIds}
              canSelectMany
              maxLevel={2}
            />
          </div>

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
              <select
                style={{ border: 'none', background: '#F5F5F9', borderRadius: 8, padding: '4px 6px', fontSize: 13, fontWeight: 600, color: '#111', cursor: 'pointer', outline: 'none' }}
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {['BYN','RUB','USD','EUR','UAH','GBP','KZT','UZS'].map(code => {
                  const info = CURRENCIES.find(c => c.code === code)
                  return <option key={code} value={code}>{info?.symbol ?? code} {code}</option>
                })}
              </select>
              {!isPaid && <span className={styles.free_badge}>{t('priceFree')}</span>}
            </div>
          </div>

          {isPaid && (
            <div>
              <p className={styles.grid_label}>{t('currencyPreview')}</p>
              <div className={styles.currency_grid}>
                {FEATURED_CURRENCIES.map((cur) => (
                  <div key={cur.code} className={styles.currency_cell}>
                    <FlagIcon code={cur.flag} width={20} />
                    <div className={styles.cell_body}>
                      <span className={styles.cell_code}>{cur.code}</span>
                      <span className={styles.cell_amount}>{formatConverted(priceNum, cur)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isPaid && !vipLoading && isVip === false && (
            <div className={styles.vip_notice}>
              <span className={styles.vip_icon}>👑</span>
              <div className={styles.vip_text}>
                <p className={styles.vip_title}>{t('vipRequired')}</p>
                <p className={styles.vip_desc}>{t('vipRequiredDesc')}</p>
                <button
                  className={styles.vip_btn}
                  onClick={() => { onClose(); router.push('/vip') }}
                >
                  {t('purchaseVip')} →
                </button>
              </div>
            </div>
          )}

          {isPaid && vipLoading && (
            <p style={{ fontSize: 13, color: '#868897' }}>{t('vipChecking')}</p>
          )}
        </div>
      )}
    </ModalWindowDefault>
  )
}
