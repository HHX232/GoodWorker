'use client'

import { CURRENCIES, formatConverted } from '@/shared/utils/currencyConverter'
import { useLocale } from 'next-intl'
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
  _count: { comments: number; ratings: number }
  teacher: { id: string; name: string; avatarUrl: string | null }
  useLink?: boolean
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
  _count,
  teacher,
  useLink = true,
}) => {
  const [priceHovered, setPriceHovered] = useState(false)
  const locale = useLocale()
  const activeCurrency = CURRENCIES.find((c) => c.code === (LOCALE_CURRENCY[locale] ?? 'RUB')) ?? RUB

  const images = [
    previewImageUrl,
    mediaPreviewUrls[0] ?? null,
  ].filter(Boolean) as string[]

  const href = `/road-map/${id}`

  return (
    <div className={styles.card}>
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
        ) : (
          <span className={styles.free_badge}>Бесплатно</span>
        )}
      </div>

      {useLink ? (
        <Link href={href} className={styles.open_btn}>
          <span>Открыть роадмап</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="#868897" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : (
        <div className={styles.open_btn}>
          <span>Открыть роадмап</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="#868897" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}
