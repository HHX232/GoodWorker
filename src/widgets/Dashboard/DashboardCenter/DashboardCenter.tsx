'use client'

import Link from 'next/link'
import { ServiceCard } from '@/shared/ui/Service/ServiceCard/ServiceCard'
import { TestPreviewCard, TestPreviewCardProps } from '@/shared/ui/Test/TestPreviewCard/TestPreviewCard'
import { CreatePickerModal } from '@/widgets/Dashboard/CreatePickerModal/CreatePickerModal'
import { CreateServiceModal } from '@/widgets/Dashboard/CreateServiceModal/CreateServiceModal'
import { BookServiceModal } from '@/widgets/Dashboard/BookServiceModal/BookServiceModal'
import { VideoZone } from '@/widgets/Dashboard/VideoZone/VideoZone'
import { ChatBubbleIcon } from '@/widgets/Chat/icons'
import Card from '@/shared/ui/Posts/Card/Card'
import { RoadMapPreview } from '@/shared/ui/RoadMap/RoadMapPreview/RoadMapPreview'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  hasMiniTest?: boolean
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
  currency?: string
  category?: { translations: { langCode: string; name: string }[] } | null
  originalLangCode?: string
  isTranslated?: boolean
  isPersonal?: boolean
  isPersonalForMe?: boolean
}

type TestItem = Omit<TestPreviewCardProps, 'isOwner' | 'onDelete'>

interface Props {
  statsId: string
  studentCount: number
  callCount: number
  totalHours: number
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
    hasMiniTest: p.hasMiniTest ?? false,
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

export function DashboardCenter({ statsId, studentCount, callCount, totalHours, isOwner = false, ownerName = '' }: Props) {
  const t = useTranslations('dashboard')
  const tChat = useTranslations('chat')
  const locale = useLocale()
  const { data: session } = useSession()
  const [tab, setTab] = useState<Tab>('all')
  const [roadmaps, setRoadmaps] = useState<RoadmapItem[]>([])
  const [posts, setPosts] = useState<PostItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  // React Query (not local state) so this list reacts to the same
  // invalidateQueries(['tests', ...]) call useSaveTest fires on save/delete —
  // a plain useState+fetch here never refreshed after saving a test elsewhere.
  const { data: testsData } = useQuery({
    queryKey: ['tests', 'teacher', statsId],
    queryFn: () => fetch(`/api/tests?teacherId=${statsId}`).then(r => r.json()),
    enabled: !!statsId,
  })
  const tests: TestItem[] = Array.isArray(testsData) ? testsData : []
  const [pickerOpen, setPickerOpen] = useState(false)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [bookingService, setBookingService] = useState<ServiceItem | null>(null)

  const canBook = !isOwner && session?.user?.role === 'STUDENT'
  const blockedFromBooking = !isOwner && !!session?.user && session.user.role !== 'STUDENT'

  // Unread chat count for the 4th stats-strip item — only the profile owner
  // sees the strip's owner-only items (stats links, chat entry), so this
  // mirrors ChatHeaderIcon's own 15s poll rather than sharing state with it
  // (different component tree, no shared store for this in the project).
  const [unreadChats, setUnreadChats] = useState(0)
  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    const fetchUnread = () => {
      fetch('/api/chat/unread-count')
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (!cancelled && data) setUnreadChats(data.count ?? 0) })
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isOwner])

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
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      toast.success(t('deleteSuccess'), { id: tid })
    } catch {
      toast.error(t('deleteError'), { id: tid })
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/roadmap?teacherId=${statsId}&limit=6&lang=${locale}`).then(r => r.json()),
      fetch(`/api/posts?teacherId=${statsId}&limit=6&lang=${locale}`).then(r => r.json()),
      fetch(`/api/services?teacherId=${statsId}&lang=${locale}`).then(r => r.json()),
    ]).then(([rmData, postsData, svcData]) => {
      if (Array.isArray(rmData.roadmaps)) setRoadmaps(rmData.roadmaps)
      if (Array.isArray(postsData.posts)) setPosts(postsData.posts)
      if (Array.isArray(svcData.services)) setServices(svcData.services)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [statsId, locale])

  // Deep link from the chat's personal-service event card
  // (`/users/[teacherId]?openService=[serviceId]`) — auto-opens the booking
  // modal for that service once the list has loaded, instead of leaving the
  // student to hunt for it in the tab. Guarded to fire once: `services`
  // reloads on locale change too, and this must not re-pop the modal then.
  const openedFromQueryRef = useRef(false)
  useEffect(() => {
    if (openedFromQueryRef.current || !canBook || services.length === 0) return
    const serviceId = new URLSearchParams(window.location.search).get('openService')
    if (!serviceId) return
    const match = services.find(s => s.id === serviceId)
    if (match) {
      openedFromQueryRef.current = true
      setBookingService(match)
    }
  }, [services, canBook])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',      label: t('tabAll') },
    { key: 'services', label: t('tabServices') },
    { key: 'roadmap',  label: t('tabRoadmap') },
    { key: 'posts',    label: t('tabPosts') },
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
      value: totalHours,
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

      {/* Compact stats strip */}
      <div className={styles.statsMerged}>
        {stats.map((s, i) => (
          isOwner ? (
            <Link key={s.label} href={`/statistics/${statsId}`} className={`${styles.statsItem} ${styles.statsItemLink}`}>
              {i > 0 && <div className={styles.statsSep} />}
              <div className={styles.statsItemIcon} style={{ background: s.bg }}>{s.icon}</div>
              <div>
                <div className={styles.statsItemValue}>{s.value}</div>
                <div className={styles.statsItemLabel}>{s.label}</div>
              </div>
            </Link>
          ) : (
            <div key={s.label} className={styles.statsItem}>
              {i > 0 && <div className={styles.statsSep} />}
              <div className={styles.statsItemIcon} style={{ background: s.bg }}>{s.icon}</div>
              <div>
                <div className={styles.statsItemValue}>{s.value}</div>
                <div className={styles.statsItemLabel}>{s.label}</div>
              </div>
            </div>
          )
        ))}

        {/* 4th item — chats entry, same shape as the stats above (icon tile +
            value + label), value is the unread count instead of a stat. */}
        {isOwner && (
          <Link href="/chats" className={`${styles.statsItem} ${styles.statsItemLink}`}>
            <div className={styles.statsSep} />
            <div className={styles.statsItemIcon} style={{ background: '#EDE9FE' }}>
              <ChatBubbleIcon size={15} strokeWidth={2} color="#534AB7" />
            </div>
            <div>
              <div className={styles.statsItemValue}>{unreadChats}</div>
              <div className={styles.statsItemLabel}>{tChat('dashboardStatsLabel')}</div>
            </div>
          </Link>
        )}
      </div>

      {/* Video zone — visible for owner only */}
      {isOwner && <VideoZone ownerName={ownerName} />}

      {/* Tabs */}
      <div className={styles.tabs} id="dashboard-content-tabs">
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
        <div className={styles.grid} id="dashboard-content-grid">

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
              currency={s.currency}
              isOwner={isOwner}
              isPersonalForMe={s.isPersonalForMe}
              onDelete={isOwner ? () => handleDeleteService(s.id) : undefined}
              onEdit={isOwner ? () => { setEditingService(s); setServiceModalOpen(true) } : undefined}
              onBook={
                canBook
                  ? () => setBookingService(s)
                  : blockedFromBooking
                    ? () => toast.error(t('teachersCannotBook'))
                    : undefined
              }
              onClick={
                isOwner
                  ? () => { setEditingService(s); setServiceModalOpen(true) }
                  : canBook
                    ? () => setBookingService(s)
                    : blockedFromBooking
                      ? () => toast.error(t('teachersCannotBook'))
                      : undefined
              }
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
        onClose={() => { setServiceModalOpen(false); setEditingService(null) }}
        teacherId={statsId}
        editService={editingService ?? undefined}
        onCreated={(svc) => {
          const service = svc as ServiceItem
          if (editingService) {
            setServices(prev => prev.map(s => s.id === service.id ? { ...s, ...service } : s))
          } else {
            setServices(prev => [service, ...prev])
          }
        }}
      />

      <BookServiceModal
        open={bookingService !== null}
        onClose={() => setBookingService(null)}
        service={bookingService}
      />
    </div>
  )
}
