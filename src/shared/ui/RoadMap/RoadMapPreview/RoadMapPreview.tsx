'use client'

import { CURRENCIES, formatConverted } from '@/shared/utils/currencyConverter'
import { CardOwnerMenu } from '@/shared/ui/CardOwnerMenu/CardOwnerMenu'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { FC, useState } from 'react'
import UserHeaderCard from '../../User/UserHeaderCard/UserHeaderCard'
import styles from './RoadMapPreview.module.scss'

interface RoadMapPreviewProps {
  id: string
  title: string
  price: number
  previewImageUrl: string | null
  mediaPreviewUrls: string[]
  avgRating: number
  nodeAccessType?: string | null
  originalLanguage?: string | null
  _count: { comments: number; ratings: number }
  teacher: { id: string; name: string; avatarUrl: string | null }
  useLink?: boolean
  isOwner?: boolean
  onDelete?: () => void
  grayscale?: boolean
}

const TOOLTIP_CODES = ['USD', 'EUR', 'BYN', 'CNY', 'INR', 'GBP', 'JPY', 'KZT', 'UAH', 'TRY', 'AED', 'KRW']
const TOOLTIP_CURRENCIES = CURRENCIES.filter((c) => TOOLTIP_CODES.includes(c.code))

const LOCALE_CURRENCY: Record<string, string> = { ru: 'RUB', en: 'USD', hi: 'INR', zh: 'CNY' }
const RUB = CURRENCIES.find((c) => c.code === 'RUB')!

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const CommentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#868897" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export const RoadMapPreview: FC<RoadMapPreviewProps> = ({
  id,
  title,
  price,
  previewImageUrl,
  mediaPreviewUrls,
  avgRating,
  nodeAccessType = null,
  originalLanguage = null,
  _count,
  teacher,
  useLink = true,
  isOwner = false,
  onDelete,
  grayscale = false,
}) => {
  const isPartiallyFree = price === 0 && nodeAccessType !== null
  const [priceHovered, setPriceHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const locale = useLocale()
  const t = useTranslations('roadmapPreview')
  const tDash = useTranslations('dashboard')
  const tLangs = useTranslations('roadmapPreview.languages')
  const activeCurrency = CURRENCIES.find((c) => c.code === (LOCALE_CURRENCY[locale] ?? 'RUB')) ?? RUB
  const showLangBadge = originalLanguage && originalLanguage !== locale

  const images = [
    previewImageUrl,
    mediaPreviewUrls[0] ?? null,
  ].filter(Boolean) as string[]

  const href = `/road-map/${id}`

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`${styles.card} ${grayscale ? styles.grayscale : ''}`} style={{ position: 'relative' }}>
      {isOwner && onDelete && (
        <CardOwnerMenu onDelete={onDelete} deleteLabel={tDash('deleteItem')} />
      )}
      <UserHeaderCard
        userID={teacher.id}
        cardID={id}
        image={teacher.avatarUrl ?? undefined}
        role="Teacher"
        name={teacher.name}
        useLink={useLink}
        BlurDots
      />

      {useLink ? (
        <Link href={href} className={styles.title_link}>
          <h5 className={styles.title}>{title}</h5>
        </Link>
      ) : (
        <div className={styles.title_link}>
          <h5 className={styles.title}>{title}</h5>
        </div>
      )}

      {showLangBadge && (
        <div className={styles.lang_badge}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>{t('originalLang')}: {tLangs(originalLanguage as Parameters<typeof tLangs>[0]) ?? originalLanguage}</span>
        </div>
      )}

      {images.length > 0 && (
        <ul className={styles.images_list}>
          {images.map((url, i) => (
            <li key={`${id}-img-${i}`} className={`${styles.images_item} ${i > 0 ? styles.secondary_item : ''}`}>
              {useLink ? (
                <Link href={href} className={styles.image_link}>
                  <div style={{ backgroundImage: `url(${url})` }} className={styles.image} />
                </Link>
              ) : (
                <div className={styles.image_link}>
                  <div style={{ backgroundImage: `url(${url})` }} className={styles.image} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.footer}>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <StarIcon />
            <span>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
          </span>
          <span className={styles.stat}>
            <CommentIcon />
            <span>{_count.comments}</span>
          </span>
        </div>

        {price > 0 ? (
          <div
            className={styles.price_wrap}
            onMouseEnter={() => setPriceHovered(true)}
            onMouseLeave={() => setPriceHovered(false)}
          >
            <span className={styles.price_badge}>{formatConverted(price, activeCurrency)}</span>
            {priceHovered && (
              <div className={styles.price_tooltip}>
                {TOOLTIP_CURRENCIES.map((cur) => (
                  <div key={cur.code} className={styles.tooltip_item}>
                    <span className={styles.tooltip_code}>{cur.flag} {cur.code}</span>
                    <span className={styles.tooltip_amount}>{formatConverted(price, cur)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isPartiallyFree ? (
          <span className={styles.partial_badge}>{t('partiallyFree')}</span>
        ) : (
          <span className={styles.free_badge}>{t('free')}</span>
        )}
      </div>

      <div className={styles.bottom_row}>
        {useLink ? (
          <Link href={href} className={styles.open_btn}>
            <span>{t('open')}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="#868897" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <div className={styles.open_btn}>
            <span>{t('open')}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="#868897" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {isOwner && (
          <Link href={`/create-road-map?edit=${id}`} className={styles.edit_btn} title={t('edit')} onClick={(e) => e.stopPropagation()}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
              <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
            </svg>
          </Link>
        )}

        <button
          type="button"
          className={`${styles.share_btn} ${copied ? styles.share_btn_copied : ''}`}
          onClick={handleShare}
          title={copied ? '✓' : t('share')}
        >
          {copied ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
