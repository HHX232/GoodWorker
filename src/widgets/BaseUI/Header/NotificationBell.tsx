'use client'

import {useSession} from 'next-auth/react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'
import styles from './NotificationBell.module.scss'

const CREATION_PAGES = ['/create-post', '/create-road-map', '/create-test', '/edit-post']
// Pages that already have NotificationsPanel in the right sidebar column
const PAGES_WITH_SIDEBAR_NOTIFS = ['/', '/teachers']

interface NotifItem {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч`
  return `${Math.floor(h / 24)} д`
}

export function NotificationBell() {
  const {data: session} = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const isCreation = CREATION_PAGES.some((p) => pathname.startsWith(p))
  const hasSidebarPanel = PAGES_WITH_SIDEBAR_NOTIFS.includes(pathname)

  const fetchNotifs = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items ?? [])
      setUnread(data.unreadCount ?? 0)
    } catch {
      // ignore
    }
  }, [session?.user])

  // Initial fetch + periodic refresh every 60s
  useEffect(() => {
    if (!session?.user) return
    setLoading(true)
    fetchNotifs().finally(() => setLoading(false))
    const interval = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifs, session?.user])

  // Refetch when panel opens
  useEffect(() => {
    if (open) fetchNotifs()
  }, [open, fetchNotifs])

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/subscriptions', {method: 'PATCH'})
      setItems((prev) => prev.map((n) => ({...n, isRead: true})))
      setUnread(0)
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
        aria-label='Уведомления'
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
        <div className={styles.dropdown}>
          <div className={styles.dropdown_header}>
            <span className={styles.dropdown_title}>Уведомления</span>
            {unread > 0 && (
              <button className={styles.mark_all_btn} onClick={markAllRead} type='button'>
                Прочитать все
              </button>
            )}
          </div>

          <div className={styles.list}>
            {loading && <p className={styles.loading}>Загрузка...</p>}

            {!loading && items.length === 0 && (
              <div className={styles.empty}>
                <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='#d1d5db' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                  <path d='M13.73 21a2 2 0 0 1-3.46 0' />
                </svg>
                <span>Уведомлений нет</span>
              </div>
            )}

            {items.map((n) => (
              <div
                key={n.id}
                className={`${styles.notif_row} ${!n.isRead ? styles.notif_row_unread : ''}`}
              >
                <span className={`${styles.notif_dot} ${n.isRead ? styles.notif_dot_read : ''}`} />
                <div className={styles.notif_content}>
                  <p className={styles.notif_title}>{n.title}</p>
                  <p className={styles.notif_body}>{n.body}</p>
                </div>
                <span className={styles.notif_time}>{formatTime(n.createdAt)}</span>
              </div>
            ))}
          </div>

          <Link href='/notifications' className={styles.footer_link} onClick={() => setOpen(false)}>
            Смотреть все уведомления
          </Link>
        </div>
      )}
    </div>
  )
}
