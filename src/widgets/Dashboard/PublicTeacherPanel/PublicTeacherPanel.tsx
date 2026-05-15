'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import styles from './PublicTeacherPanel.module.scss'

interface CategoryTranslation {
  langCode: string
  name: string
}

interface Category {
  id: string
  slug: string
  translations: CategoryTranslation[]
}

interface Props {
  name: string
  avatarUrl: string | null
  isVip: boolean
  createdAt: string
  studentCount: number
  postCount: number
  callCount: number
  categories: Category[]
  locale?: string
}

export function PublicTeacherPanel({
  name, avatarUrl, isVip, createdAt, studentCount, postCount, callCount, categories, locale = 'en',
}: Props) {
  const t = useTranslations('dashboard')

  const categoryNames = categories.map(cat => {
    const tr = cat.translations.find(t => t.langCode === locale)
      ?? cat.translations.find(t => t.langCode === 'ru')
      ?? cat.translations[0]
    return tr?.name ?? cat.slug
  })

  const memberSince = new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })

  const infos = [
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      label: t('students'),
      value: studentCount,
      bg: '#EEF2FF',
    },
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
      label: t('tabPosts'),
      value: postCount,
      bg: '#E0F2FE',
    },
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
          <rect x="1" y="6" width="14" height="12" rx="2" />
        </svg>
      ),
      label: t('calls'),
      value: callCount,
      bg: '#D1FAE5',
    },
  ]

  return (
    <aside className={styles.panel}>
      <div className={styles.scroll}>

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarRing}>
              {avatarUrl ? (
                <Image width={80} height={80} src={avatarUrl} alt={name} className={styles.avatarImg} />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#ABABAB" strokeWidth="1.5" />
                  <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            {isVip && (
              <div className={styles.vipBadge}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#F0B429" stroke="#F0B429" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
            )}
          </div>
          <div className={styles.heroName}>{name}</div>
          <div className={styles.heroRole}>{t('teacher')}</div>
          <div className={styles.memberSince}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {t('memberSince')} {memberSince}
          </div>
        </div>

        <div className={styles.divider} />

        {/* Stats row */}
        <div className={styles.statsRow}>
          {infos.map(info => (
            <div key={info.label} className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: info.bg }}>{info.icon}</div>
              <div className={styles.statValue}>{info.value}</div>
              <div className={styles.statLabel}>{info.label}</div>
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        {/* Subjects */}
        {categoryNames.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{t('subjectsLabel')}</div>
            <div className={styles.chips}>
              {categoryNames.map(name => (
                <span key={name} className={styles.chip}>{name}</span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.divider} />

        {/* About stub */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('aboutLabel')}</div>
          <div className={styles.aboutRow}>
            <div className={styles.aboutItem}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{t('hoursLabel', { count: callCount })}</span>
            </div>
            <div className={styles.aboutItem}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
              </svg>
              <span>{t('roadmapsLabel')}</span>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
