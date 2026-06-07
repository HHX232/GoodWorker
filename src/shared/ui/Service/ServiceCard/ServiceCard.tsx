'use client'

import { CardOwnerMenu } from '@/shared/ui/CardOwnerMenu/CardOwnerMenu'
import { CURRENCIES, TOOLTIP_CURRENCIES, convertBetween } from '@/shared/utils/currencyConverter'
import { FlagIcon } from '@/shared/ui/FlagIcon/FlagIcon'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styles from './ServiceCard.module.scss'

export interface ServiceCardProps {
  id: string
  title: string
  photoUrl: string | null
  duration: number
  timeFrom: string
  timeTo: string
  isGroup: boolean
  price: number
  currency?: string
  category?: { translations: { langCode: string; name: string }[] } | null
  locale?: string
  originalLangCode?: string
  isTranslated?: boolean
  isOwner?: boolean
  isPersonalForMe?: boolean
  onDelete?: () => void
  onEdit?: () => void
  onBook?: () => void
}

const LANG_NAMES: Record<string, string> = {
  ru: 'Russian', en: 'English', hi: 'Hindi', zh: 'Chinese', de: 'German', fr: 'French', es: 'Spanish',
}

const LOCALE_STRINGS: Record<string, { min: string; h: string; book: string }> = {
  ru: { min: 'мин', h: 'ч', book: 'Записаться' },
  en: { min: 'min', h: 'h', book: 'Book' },
  hi: { min: 'मिनट', h: 'घं', book: 'बुक करें' },
  zh: { min: '分钟', h: '时', book: '预订' },
}

const GRADIENTS = [
  'linear-gradient(135deg, #6B63D9, #9B93F0)',
  'linear-gradient(135deg, #059669, #34D399)',
  'linear-gradient(135deg, #0369A1, #38BDF8)',
  'linear-gradient(135deg, #7C3AED, #A78BFA)',
  'linear-gradient(135deg, #B45309, #FCD34D)',
]

function pickGradient(title: string): string {
  const code = title.charCodeAt(0) + (title.charCodeAt(1) || 0)
  return GRADIENTS[code % GRADIENTS.length]
}

function fmtDuration(mins: number, locale: string): string {
  const s = LOCALE_STRINGS[locale] ?? LOCALE_STRINGS.ru
  if (mins < 60) return `${mins} ${s.min}`
  const h = mins / 60
  return `${h} ${s.h}`
}

function getCategoryName(
  category: { translations: { langCode: string; name: string }[] } | null | undefined,
  locale: string
): string | null {
  if (!category) return null
  const t = category.translations.find(t => t.langCode === locale)
    ?? category.translations.find(t => t.langCode === 'ru')
    ?? category.translations[0]
  return t?.name ?? null
}

function IconGroup() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconPerson() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function ServiceCard({
  title,
  photoUrl,
  duration,
  timeFrom,
  timeTo,
  isGroup,
  price,
  currency = 'BYN',
  category,
  locale = 'ru',
  originalLangCode,
  isTranslated,
  isOwner = false,
  isPersonalForMe = false,
  onDelete,
  onEdit,
  onBook,
}: ServiceCardProps) {
  const tDash = useTranslations('dashboard')
  const categoryName = getCategoryName(category, locale)
  const gradient = pickGradient(title)
  const ls = LOCALE_STRINGS[locale] ?? LOCALE_STRINGS.ru
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const currencyInfo = CURRENCIES.find(c => c.code === currency)
  const priceLabel = currencyInfo
    ? `${price.toLocaleString('ru-RU')} ${currencyInfo.symbol}`
    : `${price.toLocaleString('ru-RU')} ${currency}`

  const tooltipItems = TOOLTIP_CURRENCIES
    .filter(code => code !== currency)
    .map(code => {
      const cur = CURRENCIES.find(c => c.code === code)
      if (!cur) return null
      const converted = convertBetween(price, currency, code)
      const formatted = converted >= 1000
        ? Math.round(converted).toLocaleString('ru-RU')
        : converted >= 1 ? converted.toFixed(2) : converted.toFixed(4)
      return { code, symbol: cur.symbol, flag: cur.flag, label: `${formatted} ${cur.symbol}` }
    })
    .filter(Boolean) as { code: string; symbol: string; flag: string; label: string }[]

  return (
    <div className={styles.card}>
      {isOwner && onDelete && (
        <CardOwnerMenu
          onDelete={onDelete}
          deleteLabel={tDash('deleteItem')}
          onEdit={onEdit}
          editLabel={tDash('editItem')}
        />
      )}
      <div
        className={styles.bg}
        style={
          photoUrl
            ? { backgroundImage: `url(${photoUrl})` }
            : { background: gradient }
        }
      />
      <div className={styles.overlay} />

      <div className={styles.top}>
        <h3 className={styles.title}>{title}</h3>
        {isPersonalForMe && (
          <span className={styles.personalBadge}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            {tDash('personalOffer')}
          </span>
        )}
        {isTranslated && originalLangCode && (
          <span className={styles.translatedBadge}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
            </svg>
            {LANG_NAMES[originalLangCode] ?? originalLangCode}
          </span>
        )}
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomLeft}>
          {categoryName && (
            <span className={styles.chip}>{categoryName}</span>
          )}
          <span className={styles.badge}>
            <IconClock />
            {fmtDuration(duration, locale)}
          </span>
        </div>
        <div className={styles.bottomRight}>
          <span className={styles.typeIcon} title={isGroup ? 'Group' : 'Personal'}>
            {isGroup ? <IconGroup /> : <IconPerson />}
          </span>
          <span className={styles.timeRange}>{timeFrom}–{timeTo}</span>
          <span
            className={styles.price}
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            {priceLabel}
            {tooltipVisible && tooltipItems.length > 0 && (
              <span className={styles.priceTooltip}>
                {tooltipItems.map(item => (
                  <span key={item.code} className={styles.tooltipRow}>
                    <FlagIcon code={item.flag} width={16} />
                    <span className={styles.tooltipCode}>{item.code}</span>
                    <span className={styles.tooltipAmount}>{item.label}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        </div>
      </div>

      {onBook && (
        <button
          className={styles.bookBtn}
          onClick={e => { e.stopPropagation(); onBook() }}
        >
          {ls.book}
        </button>
      )}
    </div>
  )
}
