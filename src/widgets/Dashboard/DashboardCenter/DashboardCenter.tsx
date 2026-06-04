'use client'

import { ServiceCard } from '@/shared/ui/Service/ServiceCard/ServiceCard'
import { TestPreviewCard, TestPreviewCardProps } from '@/shared/ui/Test/TestPreviewCard/TestPreviewCard'
import { CreatePickerModal } from '@/widgets/Dashboard/CreatePickerModal/CreatePickerModal'
import { CreateServiceModal } from '@/widgets/Dashboard/CreateServiceModal/CreateServiceModal'
import { BookServiceModal } from '@/widgets/Dashboard/BookServiceModal/BookServiceModal'
import { VideoCallModal } from '@/widgets/Dashboard/VideoCallModal/VideoCallModal'
import Card from '@/shared/ui/Posts/Card/Card'
import { RoadMapPreview } from '@/shared/ui/RoadMap/RoadMapPreview/RoadMapPreview'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import styles from './DashboardCenter.module.scss'

type Tab = 'all' | 'roadmap' | 'posts' | 'services' | 'tests'

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

interface ServiceItem {
  id: string
  title: string
  photoUrl: string | null
  duration: number
  timeFrom: string
  timeTo: string
  isGroup: boolean
  price: number
  category?: { translations: { langCode: string; name: string }[] } | null
  originalLangCode?: string
  isTranslated?: boolean
}

type TestItem = Omit<TestPreviewCardProps, 'isOwner' | 'onDelete'>

interface Props {
  statsId: string
  studentCount: number
  callCount: number
  isOwner?: boolean
  ownerName?: string
}

function IconInbox() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

export function DashboardCenter({ statsId, studentCount, callCount, isOwner = false, ownerName = '' }: Props) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const { data: session } = useSession()
  const [tab, setTab] = useState<Tab>('all')
  const [roadmaps, setRoadmaps] = useState<RoadmapItem[]>([])
  const [posts, setPosts] = useState<PostItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [tests, setTests] = useState<TestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [bookingService, setBookingService] = useState<ServiceItem | null>(null)
  const [videoOpen, setVideoOpen] = useState(false)

  const canBook = !isOwner && session?.user?.role === 'STUDENT'

  async function handleDeletePost(id: string) {
    if (!window.confirm(t('deleteConfirm'))) return
    const tid = toast.loading(t('loading'))
    try {
      const res = await fetch(`/api/post/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setPosts(prev => prev.filter(p => p.id !== id))
      toast.success(t('deleteSuccess'), { id: tid })
    } catch {
      toast.error(t('deleteError'), { id: tid })
    }
  }

  async function handleDeleteRoadmap(id: string) {
    if (!window.confirm(t('deleteConfirm'))) return
    const tid = toast.loading(t('loading'))
    try {
      const res = await fetch(`/api/roadmap/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setRoadmaps(prev => prev.filter(r => r.id !== id))
      toast.success(t('deleteSuccess'), { id: tid })
    } catch {
      toast.error(t('deleteError'), { id: tid })
    }
  }

  async function handleDeleteService(id: string) {
    if (!window.confirm(t('deleteConfirm'))) return
    const tid = toast.loading(t('loading'))
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setServices(prev => prev.filter(s => s.id !== id))
      toast.success(t('deleteSuccess'), { id: tid })
    } catch {
      toast.error(t('deleteError'), { id: tid })
    }
  }

  async function handleDeleteTest(id: string) {
    if (!window.confirm(t('deleteConfirm'))) return
    const tid = toast.loading(t('loading'))
    try {
      const res = await fetch(`/api/tests/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setTests(prev => prev.filter(t => t.id !== id))
      toast.success(t('deleteSuccess'), { id: tid })
    } catch {
      toast.error(t('deleteError'), { id: tid })
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/roadmap?teacherId=${statsId}&limit=6`).then(r => r.json()),
      fetch(`/api/posts?teacherId=${statsId}&limit=6`).then(r => r.json()),
      fetch(`/api/services?teacherId=${statsId}`).then(r => r.json()),
      fetch(`/api/tests?teacherId=${statsId}`).then(r => r.json()),
    ]).then(([rmData, postsData, svcData, testsData]) => {
      if (Array.isArray(rmData.roadmaps)) setRoadmaps(rmData.roadmaps)
      if (Array.isArray(postsData.posts)) setPosts(postsData.posts)
      if (Array.isArray(svcData.services)) setServices(svcData.services)
      if (Array.isArray(testsData)) setTests(testsData)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [statsId])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',      label: t('tabAll') },
    { key: 'roadmap',  label: t('tabRoadmap') },
    { key: 'posts',    label: t('tabPosts') },
    { key: 'services', label: t('tabServices') },
    { key: 'tests',    label: t('tabTests') },
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
  const showTests    = tab === 'all' || tab === 'tests'

  const visibleRoadmaps = showRoadmaps ? (tab === 'all' ? roadmaps.slice(0, 3) : roadmaps) : []
  const visiblePosts    = showPosts    ? (tab === 'all' ? posts.slice(0, 3)    : posts)    : []
  const visibleServices = showServices ? (tab === 'all' ? services.slice(0, 2) : services) : []
  const visibleTests    = showTests    ? (tab === 'all' ? tests.slice(0, 2)    : tests)    : []

  const isEmpty = !loading
    && visibleRoadmaps.length === 0
    && visiblePosts.length === 0
    && visibleServices.length === 0
    && visibleTests.length === 0
    && !isOwner

  return (
    <div className={styles.center}>

      {/* Stats + video call top row */}
      <div className={styles.topRow}>
        <div className={styles.statsMerged}>
          {stats.map((s, i) => (
            <div key={s.label} className={styles.statsItem}>
              {i > 0 && <div className={styles.statsSep} />}
              <div className={styles.statsItemIcon} style={{ background: s.bg }}>{s.icon}</div>
              <div>
                <div className={styles.statsItemValue}>{s.value}</div>
                <div className={styles.statsItemLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {isOwner && (
          <div className={styles.videoCallBlock}>
            <div className={styles.videoCallTitle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
                <rect x="1" y="6" width="14" height="12" rx="2" />
              </svg>
              {t('videoRoom')}
            </div>
            <button className={styles.videoCallBtn} onClick={() => setVideoOpen(true)}>
              {t('createVideoCallBtn')}
            </button>
          </div>
        )}
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

          {/* Create card — always first when owner */}
          {isOwner && (
            <div className={styles.createCard} onClick={() => setPickerOpen(true)}>
              <span className={styles.createIcon}><IconPlus /></span>
              <span className={styles.createLabel}>{t('createLabel')}</span>
            </div>
          )}

          {isEmpty && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><IconInbox /></span>
              {t('empty')}
            </div>
          )}

          {/* Roadmaps */}
          {visibleRoadmaps.map(rm => (
            <RoadMapPreview
              key={rm.id}
              {...rm}
              useLink
              isOwner={isOwner}
              onDelete={isOwner ? () => handleDeleteRoadmap(rm.id) : undefined}
            />
          ))}

          {/* Posts */}
          {visiblePosts.map(p => (
            <Card
              key={p.id}
              {...mapPost(p)}
              isOwner={isOwner}
              onDelete={isOwner ? () => handleDeletePost(p.id) : undefined}
            />
          ))}

          {/* Services */}
          {visibleServices.map(s => (
            <ServiceCard
              key={s.id}
              id={s.id}
              title={s.title}
              photoUrl={s.photoUrl}
              duration={s.duration}
              timeFrom={s.timeFrom}
              timeTo={s.timeTo}
              isGroup={s.isGroup}
              price={s.price}
              category={s.category}
              locale={locale}
              originalLangCode={s.originalLangCode}
              isTranslated={s.isTranslated}
              isOwner={isOwner}
              onDelete={isOwner ? () => handleDeleteService(s.id) : undefined}
              onBook={canBook ? () => setBookingService(s) : undefined}
            />
          ))}

          {/* Empty services hint for owner */}
          {isOwner && showServices && services.length === 0 && (
            <div className={styles.servicesHint}>
              {t('servicesFirstHint')}
            </div>
          )}

          {/* Tests */}
          {visibleTests.map(test => (
            <TestPreviewCard
              key={test.id}
              {...test}
              isOwner={isOwner}
              onDelete={isOwner ? () => handleDeleteTest(test.id) : undefined}
            />
          ))}

          {/* Empty tests hint for owner */}
          {isOwner && showTests && tests.length === 0 && (
            <div className={styles.servicesHint}>
              {t('testsFirstHint')}
            </div>
          )}

        </div>
      )}

      <CreatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onService={() => setServiceModalOpen(true)}
      />

      <CreateServiceModal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        teacherId={statsId}
        onCreated={(svc) => setServices(prev => [svc as ServiceItem, ...prev])}
      />

      <BookServiceModal
        open={bookingService !== null}
        onClose={() => setBookingService(null)}
        service={bookingService}
      />

      {videoOpen && <VideoCallModal defaultName={ownerName} onClose={() => setVideoOpen(false)} />}
    </div>
  )
}
