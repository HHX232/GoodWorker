'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { CreateImagesInput } from '@/shared/ui/inputs/CreateImagesInput/CreateImagesInput'
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

const SOCIAL_ICONS: Record<string, { label: string; icon: React.ReactNode }> = {
  vk: {
    label: 'VKontakte',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.714-1.033-1-1.49-.85-1.49.35v1.56c0 .4-.13.55-.72.55-1.293 0-2.734-.786-3.74-2.254C8.22 13.17 7.5 11.02 7.5 10.5c0-.28.1-.44.46-.44h1.744c.34 0 .47.16.6.54.65 1.96 1.73 3.68 2.18 3.68.17 0 .25-.08.25-.52V11.7c-.05-.93-.54-1.01-.54-1.34 0-.18.14-.37.38-.37h2.74c.3 0 .4.16.4.5v3.21c0 .3.13.4.21.4.17 0 .31-.1.62-.41 1.16-1.3 1.99-3.3 1.99-3.3.11-.24.3-.47.65-.47h1.744c.52 0 .63.27.52.54-.42.98-1.45 2.82-1.45 2.82-.15.24-.2.35 0 .62.14.2.6.61 1 1.01.87.87 1.53 1.6 1.72 2.1.19.5-.06.75-.55.75z"/></svg>,
  },
  telegram: {
    label: 'Telegram',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>,
  },
  instagram: {
    label: 'Instagram',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  },
  youtube: {
    label: 'YouTube',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
  },
  website: {
    label: 'Website',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  },
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
  bio?: string | null
  coverPhotoUrl?: string | null
  socialLinks?: Record<string, string> | null
  teachingLanguage?: string | null
  availableServices?: string[]
  experiences?: { id: string; title: string; organization: string | null; yearFrom: number; yearTo: number | null; description: string | null; verifiedAt: string | null }[]
}

const ALL_SERVICE_KEYS = ['individual', 'group', 'homework', 'consultation'] as const

export function PublicTeacherPanel({
  name, avatarUrl, isVip, createdAt, studentCount, postCount, callCount, categories, locale = 'en',
  bio, coverPhotoUrl, socialLinks, teachingLanguage,
  availableServices = ['individual', 'group', 'homework', 'consultation'],
  experiences,
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

        {/* Services */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('servicesTitle')}</div>
          <div className={styles.chips}>
            {(availableServices as string[])
              .filter((k) => (ALL_SERVICE_KEYS as readonly string[]).includes(k))
              .map((k) => (
                <span key={k} className={styles.chip}>
                  {t(`services.${k as typeof ALL_SERVICE_KEYS[number]}.title`)}
                </span>
              ))}
          </div>
          {teachingLanguage && (
            <div className={styles.langBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{t('teachingLanguage')}: {teachingLanguage}</span>
            </div>
          )}
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

        {/* About */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('aboutLabel')}</div>

          {coverPhotoUrl && (
            <CreateImagesInput
              activeImages={[coverPhotoUrl]}
              isOnlyShow={true}
              onFilesChange={() => {}}
              maxFiles={1}
              showBigFirstItem={false}
              size="xs"
            />
          )}

          {bio ? (
            <p className={styles.bio}>{bio}</p>
          ) : (
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
          )}
        </div>

        {/* Social links */}
        {socialLinks && Object.keys(socialLinks).some(k => socialLinks[k]) && (
          <>
            <div className={styles.divider} />
            <div className={styles.section}>
              <div className={styles.sectionLabel}>{t('socialLinks')}</div>
              <div className={styles.socialLinks}>
                {Object.entries(SOCIAL_ICONS).map(([key, cfg]) => {
                  const url = socialLinks[key]
                  if (!url) return null
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                      title={cfg.label}
                    >
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Experience */}
        {experiences && experiences.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid #EEEFF8', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#ABABAB', marginBottom: 10 }}>
              Опыт
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {experiences.map(exp => (
                <div key={exp.id} style={{ border: '1px solid #F0F0F0', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C22' }}>{exp.title}</div>
                      {exp.organization && <div style={{ fontSize: 11, color: '#6B6B7A' }}>{exp.organization}</div>}
                      <div style={{ fontSize: 11, color: '#ABABAB' }}>{exp.yearFrom}–{exp.yearTo ?? 'н.в.'}</div>
                    </div>
                    {exp.verifiedAt && (
                      <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, flexShrink: 0 }} title={`Подтверждено ${new Date(exp.verifiedAt).toLocaleDateString()}`}>✓</span>
                    )}
                  </div>
                  {exp.description && <p style={{ fontSize: 11, color: '#6B6B7A', marginTop: 4, lineHeight: 1.4 }}>{exp.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </aside>
  )
}
