'use client'

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
  category?: { translations: { langCode: string; name: string }[] } | null
  locale?: string
  onBook?: () => void
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

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} мин`
  const h = mins / 60
  if (h === Math.floor(h)) return `${h} ч`
  return `${h} ч`
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
  category,
  locale = 'ru',
  onBook,
}: ServiceCardProps) {
  const categoryName = getCategoryName(category, locale)
  const gradient = pickGradient(title)

  return (
    <div className={styles.card}>
      {/* Background */}
      <div
        className={styles.bg}
        style={
          photoUrl
            ? { backgroundImage: `url(${photoUrl})` }
            : { background: gradient }
        }
      />
      {/* Overlay for readability */}
      <div className={styles.overlay} />

      {/* Top: title */}
      <div className={styles.top}>
        <h3 className={styles.title}>{title}</h3>
      </div>

      {/* Bottom info row */}
      <div className={styles.bottom}>
        <div className={styles.bottomLeft}>
          {categoryName && (
            <span className={styles.chip}>{categoryName}</span>
          )}
          <span className={styles.badge}>
            <IconClock />
            {fmtDuration(duration)}
          </span>
        </div>
        <div className={styles.bottomRight}>
          <span className={styles.typeIcon} title={isGroup ? 'Групповая' : 'Личная'}>
            {isGroup ? <IconGroup /> : <IconPerson />}
          </span>
          <span className={styles.timeRange}>{timeFrom}–{timeTo}</span>
          <span className={styles.price}>{price.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      {/* Book button */}
      {onBook && (
        <button
          className={styles.bookBtn}
          onClick={e => { e.stopPropagation(); onBook() }}
        >
          Записаться
        </button>
      )}
    </div>
  )
}
