'use client'

import {useSession} from 'next-auth/react'
import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import React, {useCallback, useEffect, useRef, useState} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import styles from './NotificationBell.module.scss'

function getNotifHref(type: string, payload?: Record<string, unknown>): string {
  if (type === 'NEW_COMPLAINT' || type === 'COMPLAINT_REPLIED' || type === 'COMPLAINT_CLOSED') return '/notifications'
  if (type === 'NEW_STUDENT' || type === 'NEW_REVIEW') return payload?.roadmapId ? `/road-map/${payload.roadmapId}` : '/notifications'
  if (type === 'ROADMAP_PURCHASE') return payload?.roadmapId ? `/road-map/${payload.roadmapId}` : '/notifications'
  if (type === 'NEW_COMMENT_ON_POST' || type === 'NEW_POST') return payload?.postId ? `/post/${payload.postId}` : '/notifications'
  return '/notifications'
}

const CREATION_PAGES = ['/create-post', '/create-road-map', '/create-test', '/edit-post']
const PAGES_WITH_SIDEBAR_NOTIFS = ['/teachers']

interface NotifItem {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

function formatTime(iso: string, t: ReturnType<typeof useTranslations<'notifications'>>): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('justNow')
  if (m < 60) return t('minutesAgo', {n: m})
  const h = Math.floor(m / 60)
  if (h < 24) return t('hoursAgo', {n: h})
  return t('daysAgo', {n: Math.floor(h / 24)})
}

export function NotificationBell() {
  const {data: session} = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('notifications')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const wrapRef = useRef<HTMLDivElement>(null)

  const isCreation = CREATION_PAGES.some((p) => pathname.startsWith(p))
  const hasSidebarPanel = PAGES_WITH_SIDEBAR_NOTIFS.includes(pathname)

  const locale = useLocale()

  const fetchNotifs = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch(`/api/notifications?limit=10&lang=${locale}`)
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items ?? [])
      setUnread(data.unreadCount ?? 0)
    } catch {
      // ignore
    }
  }, [session?.user, locale])

  useEffect(() => {
    if (!session?.user) return
    setLoading(true)
    fetchNotifs().finally(() => setLoading(false))
    const interval = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifs, session?.user])

  useEffect(() => {
    if (open) fetchNotifs()
  }, [open, fetchNotifs])

  useEffect(() => {
    if (!open) { setDropdownStyle({}); return }
    const header = document.querySelector('header')
    const headerBottom = header ? header.getBoundingClientRect().bottom : 80
    const vw = window.innerWidth
    if (vw <= 576) {
      setDropdownStyle({
        position: 'fixed',
        left: '12px',
        right: '12px',
        width: 'auto',
        top: `${headerBottom + 8}px`,
        maxHeight: '400px',
      })
    } else {
      setDropdownStyle({})
    }
  }, [open])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({all: true}),
      })
      // Re-fetch from server to confirm the DB state
      await fetchNotifs()
    } catch {
      // ignore
    }
  }

  if (!session?.user || hasSidebarPanel) return null

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type='button'
        className={`${styles.btn} ${open ? styles.btn_active : ''}`}
        onClick={() => setOpen((p) => !p)}
        aria-label={t('title')}
      >
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
          <path d='M13.73 21a2 2 0 0 1-3.46 0' />
        </svg>

        {unread > 0 && (
          <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>
        )}
        {isCreation && unread === 0 && (
          <span className={styles.dot} />
        )}
      </button>

      {open && (
        <div className={styles.dropdown} style={dropdownStyle}>
          <div className={styles.dropdown_header}>
            <span className={styles.dropdown_title}>{t('title')}</span>
            {unread > 0 && (
              <button className={styles.mark_all_btn} onClick={markAllRead} type='button'>
                {t('markAllRead')}
              </button>
            )}
          </div>

          <div className={styles.list}>
            {loading && <p className={styles.loading}>{t('loading')}</p>}

            {!loading && items.length === 0 && (
              <div className={styles.empty}>
                <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='#d1d5db' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                  <path d='M13.73 21a2 2 0 0 1-3.46 0' />
                </svg>
                <span>{t('empty')}</span>
              </div>
            )}

            {items.map((n) => (
              <div
                key={n.id}
                className={`${styles.notif_row} ${!n.isRead ? styles.notif_row_unread : ''}`}
                onClick={async () => {
                  setOpen(false)
                  if (!n.isRead) {
                    setItems((prev) => prev.map((x) => x.id === n.id ? {...x, isRead: true} : x))
                    setUnread((c) => Math.max(0, c - 1))
                    fetch('/api/notifications', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: [n.id]})}).catch(() => {})
                  }
                  router.push(getNotifHref(n.type))
                }}
              >
                <span className={`${styles.notif_dot} ${n.isRead ? styles.notif_dot_read : ''}`} />
                <div className={styles.notif_content}>
                  <p className={styles.notif_title}>{n.title}</p>
                  <p className={styles.notif_body}>{n.body}</p>
                </div>
                <span className={styles.notif_time}>{formatTime(n.createdAt, t)}</span>
              </div>
            ))}
          </div>

          <Link href='/notifications' className={styles.footer_link} onClick={() => setOpen(false)}>
            {t('viewAll')}
          </Link>
        </div>
      )}
    </div>
  )
}
