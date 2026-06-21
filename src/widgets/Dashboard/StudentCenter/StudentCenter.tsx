'use client'

import { RoadMapPreview } from '@/shared/ui/RoadMap/RoadMapPreview/RoadMapPreview'
import { ServiceCard } from '@/shared/ui/Service/ServiceCard/ServiceCard'
import { StudentErrorsList } from '@/shared/ui/Stats/StudentErrorsWidget/StudentErrorsList'
import { VideoCallModal } from '@/widgets/Dashboard/VideoCallModal/VideoCallModal'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import styles from './StudentCenter.module.scss'

interface PersonalService {
  id: string
  title: string
  description: string | null
  duration: number
  timeFrom: string
  timeTo: string
  price: number
  photoUrl: string | null
  teacher: { id: string; name: string; avatarUrl: string | null }
  category: { translations: { langCode: string; name: string }[] } | null
}

function PersonalServiceCard({
  service,
  onAccepted,
  t,
}: {
  service: PersonalService
  onAccepted: (id: string) => void
  t: ReturnType<typeof useTranslations>
}) {
  const [accepting, setAccepting] = useState(false)
  const handleAccept = async () => {
    setAccepting(true)
    const res = await fetch(`/api/services/${service.id}/accept`, { method: 'POST' })
    if (res.ok) onAccepted(service.id)
    setAccepting(false)
  }
  return (
    <div className={styles.personalCard}>
      <div className={styles.personalCardInfo}>
        <div className={styles.personalCardTitle}>{service.title}</div>
        <div className={styles.personalCardTeacher}>{service.teacher.name}</div>
        <div className={styles.personalCardPrice}>{service.price} ₽ · {service.duration} {t('minutes')}</div>
      </div>
      <button className={styles.acceptBtn} onClick={handleAccept} disabled={accepting}>
        {accepting ? '…' : t('acceptBtn')}
      </button>
    </div>
  )
}

type Tab = 'all' | 'roadmaps' | 'services' | 'errors'

interface RoadmapAccess {
  roadmapId: string
  roadmap: {
    id: string
    title: string
    previewImageUrl: string | null
    price: number
    teacher: { id: string; name: string; avatarUrl: string | null }
    _count: { comments: number; ratings: number }
  }
}

interface ServiceBooking {
  id: string
  status: string
  finalPrice: number
  createdAt: string
  service: {
    id: string
    title: string
    duration: number
    timeFrom: string
    timeTo: string
    price: number
    photoUrl: string | null
    category: { translations: { langCode: string; name: string }[] } | null
    teacher: { id: string; name: string; avatarUrl: string | null }
  }
}

interface Props {
  teacherCount: number
  callCount: number
  errorCount: number
  roadmapAccess: RoadmapAccess[]
  serviceBookings: ServiceBooking[]
  personalServices: PersonalService[]
  loading: boolean
  userName?: string
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#10B981',
  CANCELLED: '#EF4444',
}

function BookingStatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslations> }) {
  const labelMap: Record<string, string> = {
    PENDING: t('statusPending'),
    CONFIRMED: t('statusConfirmed'),
    CANCELLED: t('statusCancelled'),
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '99px',
      fontSize: '10px',
      fontWeight: 600,
      background: `${STATUS_COLORS[status] ?? '#ABABAB'}20`,
      color: STATUS_COLORS[status] ?? '#ABABAB',
    }}>
      {labelMap[status] ?? status}
    </span>
  )
}

export function StudentCenter({
  teacherCount, callCount, errorCount,
  roadmapAccess, serviceBookings, personalServices, loading, userName = '',
}: Props) {
  const [localPersonalServices, setLocalPersonalServices] = useState<PersonalService[]>(personalServices)
  const [videoOpen, setVideoOpen] = useState(false)

  const handlePersonalAccepted = (id: string) => {
    setLocalPersonalServices(prev => prev.filter(s => s.id !== id))
  }
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('all')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',      label: t('tabAll') },
    { key: 'roadmaps', label: t('tabRoadmaps') },
    { key: 'services', label: t('tabServices') },
    { key: 'errors',   label: t('tabErrors') },
  ]

  const stats = [
    {
      label: t('teachers'),
      value: teacherCount,
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
      label: t('lessons'),
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
      label: t('errorsLabel'),
      value: errorCount,
      bg: '#FEF2F2',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
  ]

  const showRoadmaps = tab === 'all' || tab === 'roadmaps'
  const showServices = tab === 'all' || tab === 'services'
  const showErrors   = tab === 'all' || tab === 'errors'

  const visibleRoadmaps = showRoadmaps ? (tab === 'all' ? roadmapAccess.slice(0, 3) : roadmapAccess) : []
  const visibleServices = showServices ? (tab === 'all' ? serviceBookings.slice(0, 2) : serviceBookings) : []

  const isEmpty = !loading && visibleRoadmaps.length === 0 && visibleServices.length === 0 && !showErrors

  return (
    <div className={styles.center}>
      <div className={styles.topRow}>
        <div className={styles.statsRow}>
          {stats.map(s => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: s.bg }}>{s.icon}</div>
              <div className={styles.statText}>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

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
      </div>

      {videoOpen && <VideoCallModal defaultName={userName} onClose={() => setVideoOpen(false)} />}

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

      {loading ? (
        <div className={styles.loading}>{t('loading')}</div>
      ) : (
        <>
          {localPersonalServices.length > 0 && (
            <div className={styles.personalSection}>
              <div className={styles.personalLabel}>{t('personalOffers')}</div>
              {localPersonalServices.map(ps => (
                <PersonalServiceCard key={ps.id} service={ps} onAccepted={handlePersonalAccepted} t={t} />
              ))}
            </div>
          )}

          <div className={styles.grid}>
            {isEmpty && (
              <div className={styles.empty}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
                </svg>
                {t('emptyContent')}
              </div>
            )}

            {visibleRoadmaps.map(ra => (
              <RoadMapPreview
                key={ra.roadmapId}
                id={ra.roadmap.id}
                title={ra.roadmap.title}
                previewImageUrl={ra.roadmap.previewImageUrl}
                price={ra.roadmap.price}
                avgRating={0}
                mediaPreviewUrls={[]}
                _count={{ comments: ra.roadmap._count.comments, ratings: ra.roadmap._count.ratings }}
                teacher={ra.roadmap.teacher}
                useLink
              />
            ))}

            {visibleServices.map(sb => (
              <div key={sb.id} className={styles.bookingCard}>
                <ServiceCard
                  id={sb.service.id}
                  title={sb.service.title}
                  photoUrl={sb.service.photoUrl}
                  duration={sb.service.duration}
                  timeFrom={sb.service.timeFrom}
                  timeTo={sb.service.timeTo}
                  isGroup={false}
                  price={sb.service.price}
                  category={sb.service.category}
                  locale={locale}
                />
                <div className={styles.bookingMeta}>
                  <BookingStatusBadge status={sb.status} t={t} />
                  <span className={styles.bookingTeacher}>{sb.service.teacher.name}</span>
                  <span className={styles.bookingPrice}>{sb.finalPrice} ₽</span>
                </div>
              </div>
            ))}
          </div>

          {showErrors && (
            <div className={styles.errorsSection}>
              <StudentErrorsList />
            </div>
          )}
        </>
      )}
    </div>
  )
}
