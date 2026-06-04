'use client'
import {useLocale} from 'next-intl'
import styles from './RowNotification.module.scss'

// ─── Types ───────────────────────────────────────────────

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  payload: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
}

interface Props {
  item: NotificationItem
  count?: number
  allItems?: NotificationItem[]
  onOpen: (items: NotificationItem[]) => void
}

// ─── Per-type config ──────────────────────────────────────

export interface TypeConfig {
  color: string
  bg: string
  icon: React.ReactNode
  actionLabel?: string
  hideActor?: boolean
  getHref?: (p: Record<string, unknown>) => string | null
}

export const TYPE_CONFIG: Record<string, TypeConfig> = {
  NEW_COMPLAINT: {
    color: '#f43f5e',
    bg: '#fff1f2',
    hideActor: true,
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
        <line x1='12' y1='9' x2='12' y2='13' /><line x1='12' y1='17' x2='12.01' y2='17' />
      </svg>
    ),
    actionLabel: 'Open complaints',
    getHref: () => '/complaints',
  },
  COMPLAINT_REPLIED: {
    color: '#6366f1',
    bg: '#eef2ff',
    hideActor: true,
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <polyline points='9 17 4 12 9 7' /><path d='M20 18v-2a4 4 0 0 0-4-4H4' />
      </svg>
    ),
    actionLabel: 'View reply',
    getHref: () => '/complaints',
  },
  COMPLAINT_CLOSED: {
    color: '#22c55e',
    bg: '#f0fdf4',
    hideActor: true,
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' /><polyline points='22 4 12 14.01 9 11.01' />
      </svg>
    ),
    getHref: () => null,
  },
  NEW_STUDENT: {
    color: '#0ea5e9',
    bg: '#f0f9ff',
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' /><circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' /><path d='M16 3.13a4 4 0 0 1 0 7.75' />
      </svg>
    ),
    actionLabel: 'Course',
    getHref: (p) => p.roadmapId ? `/road-map/${p.roadmapId}` : null,
  },
  ROADMAP_PURCHASE: {
    color: '#22c55e',
    bg: '#f0fdf4',
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <line x1='12' y1='1' x2='12' y2='23' /><path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' />
      </svg>
    ),
    actionLabel: 'Statistics',
    getHref: (p) => p.roadmapId ? `/road-map/${p.roadmapId}` : null,
  },
  NEW_COMMENT_ON_POST: {
    color: '#868897',
    bg: '#f7f7f7',
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
      </svg>
    ),
    actionLabel: 'Go to post',
    getHref: (p) => p.postId ? `/post/${p.postId}` : null,
  },
  NEW_REVIEW: {
    color: '#f59e0b',
    bg: '#fffbeb',
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' />
      </svg>
    ),
    actionLabel: 'Course',
    getHref: (p) => p.roadmapId ? `/road-map/${p.roadmapId}` : null,
  },
  NEW_POST: {
    color: '#141416',
    bg: '#f7f7f7',
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
        <polyline points='14 2 14 8 20 8' /><line x1='16' y1='13' x2='8' y2='13' /><line x1='16' y1='17' x2='8' y2='17' />
      </svg>
    ),
    actionLabel: 'Read post',
    getHref: (p) => p.postId ? `/post/${p.postId}` : null,
  },
  SYSTEM: {
    color: '#6366f1',
    bg: '#eef2ff',
    hideActor: true,
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <circle cx='12' cy='12' r='10' /><line x1='12' y1='8' x2='12' y2='12' /><line x1='12' y1='16' x2='12.01' y2='16' />
      </svg>
    ),
    getHref: () => null,
  },
  VIDEO_CALL_INVITE: {
    color: '#0ea5e9',
    bg: '#f0f9ff',
    icon: (
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14' />
        <rect x='1' y='6' width='14' height='12' rx='2' />
      </svg>
    ),
    actionLabel: 'Join call',
    getHref: (p) => p.roomId ? `/call/${p.roomId}` : (p.roomLink as string | null) ?? null,
  },
}

export const FALLBACK_CONFIG: TypeConfig = {
  color: '#868897',
  bg: '#f7f7f7',
  icon: (
    <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='10' /><line x1='12' y1='8' x2='12' y2='12' /><line x1='12' y1='16' x2='12.01' y2='16' />
    </svg>
  ),
}

// ─── Helpers ──────────────────────────────────────────────

export function relativeTime(iso: string, locale = 'ru'): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  const isEn = locale === 'en'
  if (min < 1) return isEn ? 'just now' : 'только что'
  if (min < 60) return isEn ? `${min} min.` : `${min} мин.`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return isEn ? `${hrs} h.` : `${hrs} ч.`
  const days = Math.floor(hrs / 24)
  if (days < 7) return isEn ? `${days} d.` : `${days} д.`
  const intlLocale = isEn ? 'en-US' : 'ru-RU'
  return new Date(iso).toLocaleDateString(intlLocale, {day: '2-digit', month: 'short'})
}

// ─── Compact row (mini panel) ─────────────────────────────

export function RowNotification({item, count = 1, allItems, onOpen}: Props) {
  const cfg = TYPE_CONFIG[item.type] ?? FALLBACK_CONFIG
  const locale = useLocale()
  const items = allItems ?? [item]
  const hasUnread = items.some((n) => !n.isRead)

  return (
    <div
      className={`${styles.row} ${hasUnread ? styles.unread : ''}`}
      onClick={() => onOpen(items)}
      style={{'--accent': cfg.color, '--accent-bg': cfg.bg} as React.CSSProperties}
    >
      <div className={styles.accent_bar} />

      <div className={styles.icon_wrap} style={{background: cfg.bg, color: cfg.color}}>
        {cfg.icon}
      </div>

      <div className={styles.content}>
        <div className={styles.top_row}>
          <div className={styles.title_row}>
            <span className={styles.title}>{item.title}</span>
            {count > 1 && (
              <span className={styles.count_badge} style={{background: cfg.color + '22', color: cfg.color}}>
                ×{count}
              </span>
            )}
          </div>
          <span className={styles.time}>{relativeTime(item.createdAt, locale)}</span>
        </div>
      </div>

      {hasUnread && (
        <div className={styles.unread_dot} style={{background: cfg.color}} />
      )}
    </div>
  )
}
