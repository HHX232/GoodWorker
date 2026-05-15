'use client'

import Card from '@/shared/ui/Posts/Card/Card'
import { RoadMapPreview } from '@/shared/ui/RoadMap/RoadMapPreview/RoadMapPreview'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import styles from './DashboardCenter.module.scss'

type Tab = 'all' | 'roadmap' | 'posts' | 'services'

interface RoadmapItem {
  id: string
  title: string
  price: number
  previewImageUrl: string | null
  mediaPreviewUrls: string[]
  avgRating: number
  nodeAccessType?: string | null
  _count: { comments: number; ratings: number }
  teacher: { id: string; name: string; avatarUrl: string | null }
}

interface PostItem {
  id: string
  title: string
  additionalTitle?: string | null
  mediaUrls: string[]
  viewCount: number
  avgRating: number
  _count: { comments: number }
  teacher: { id: string; name: string; avatarUrl: string | null }
}

interface Props {
  statsId: string
  studentCount: number
  callCount: number
}

function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
      <rect x="1" y="6" width="14" height="12" rx="2" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  )
}

function IconFileCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="9 15 11 17 15 13" />
    </svg>
  )
}

function IconTarget() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function IconInbox() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  )
}

function mapPost(p: PostItem) {
  return {
    cardId: p.id,
    title: p.title,
    subTitle: p.additionalTitle ?? '',
    user: {
      id: p.teacher.id,
      name: p.teacher.name,
      image: p.teacher.avatarUrl ?? '',
      role: 'Teacher' as const,
      dateActivity: '',
    },
    imagesArray: p.mediaUrls,
    comments: String(p._count?.comments ?? 0),
    vues: String(p.viewCount ?? 0),
    stars: p.avgRating > 0 ? p.avgRating.toFixed(1) : '0',
    userId: p.teacher.id,
    useLink: true,
  }
}

export function DashboardCenter({ statsId, studentCount, callCount }: Props) {
  const t = useTranslations('dashboard')
  const [tab, setTab] = useState<Tab>('all')
  const [roadmaps, setRoadmaps] = useState<RoadmapItem[]>([])
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/roadmap?teacherId=${statsId}&limit=6`).then(r => r.json()),
      fetch(`/api/posts?teacherId=${statsId}&limit=6`).then(r => r.json()),
    ]).then(([rmData, postsData]) => {
      if (Array.isArray(rmData.roadmaps)) setRoadmaps(rmData.roadmaps)
      if (Array.isArray(postsData.posts)) setPosts(postsData.posts)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [statsId])

  const SERVICES = [
    { icon: <IconVideo />, key: 'individual' as const },
    { icon: <IconBook />,  key: 'group' as const },
    { icon: <IconFileCheck />, key: 'homework' as const },
    { icon: <IconTarget />, key: 'consultation' as const },
  ]

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',      label: t('tabAll') },
    { key: 'roadmap',  label: t('tabRoadmap') },
    { key: 'posts',    label: t('tabPosts') },
    { key: 'services', label: t('tabServices') },
  ]

  const stats = [
    {
      label: t('students'),
      value: studentCount,
      bg: '#EEF2FF',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      label: t('calls'),
      value: callCount,
      bg: '#E0F2FE',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2" strokeLinecap="round">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
          <rect x="1" y="6" width="14" height="12" rx="2" />
        </svg>
      ),
    },
    {
      label: t('hours'),
      value: callCount,
      bg: '#FEF9C3',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ]

  const showRoadmaps = tab === 'all' || tab === 'roadmap'
  const showPosts    = tab === 'all' || tab === 'posts'
  const showServices = tab === 'all' || tab === 'services'

  const visibleRoadmaps = showRoadmaps ? (tab === 'all' ? roadmaps.slice(0, 3) : roadmaps) : []
  const visiblePosts    = showPosts    ? (tab === 'all' ? posts.slice(0, 3)    : posts)    : []

  const isEmpty = !loading && visibleRoadmaps.length === 0 && visiblePosts.length === 0 && !showServices

  return (
    <div className={styles.center}>

      {/* Stats */}
      <div className={styles.statsRow}>
        {stats.map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: s.bg }}>{s.icon}</div>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(tt => (
          <button
            key={tt.key}
            className={`${styles.tab} ${tab === tt.key ? styles.tabActive : ''}`}
            onClick={() => setTab(tt.key)}
          >
            {tt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loading}>{t('loading')}</div>
      ) : (
        <div className={styles.grid}>

          {isEmpty && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><IconInbox /></span>
              {t('empty')}
            </div>
          )}

          {/* Roadmaps */}
          {visibleRoadmaps.map(rm => (
            <RoadMapPreview key={rm.id} {...rm} useLink />
          ))}

          {/* Posts */}
          {visiblePosts.map(p => (
            <Card key={p.id} {...mapPost(p)} />
          ))}

          {/* Services */}
          {showServices && SERVICES.map(s => (
            <div key={s.key} className={styles.serviceCard}>
              <span className={styles.serviceIcon}>{s.icon}</span>
              <div className={styles.serviceTitle}>{t(`services.${s.key}.title`)}</div>
              <div className={styles.serviceDesc}>{t(`services.${s.key}.desc`)}</div>
              <span className={styles.soonBadge}>{t('soonBadge')}</span>
            </div>
          ))}

        </div>
      )}
    </div>
  )
}
