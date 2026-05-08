'use client'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import Link from 'next/link'
import {NotificationItem, RowNotification} from './RowNotification'
import {NotificationDetailModal} from './NotificationDetailModal'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import styles from './NotificationsPanel.module.scss'

const PAGE_SIZE = 20
const OLD_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000

// ─── Skeleton row ────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className={styles.skeleton_row}>
      <div className={styles.skeleton_icon} />
      <div className={styles.skeleton_content}>
        <div className={styles.skeleton_title} />
        <div className={styles.skeleton_body} />
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.empty}>
      <svg width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='#d1d5db' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
        <path d='M13.73 21a2 2 0 0 1-3.46 0' />
      </svg>
      <p>Уведомлений пока нет</p>
    </div>
  )
}

// ─── Helper: build groups map ─────────────────────────────

function buildGroups(items: NotificationItem[]) {
  const map = new Map<string, {representative: NotificationItem; all: NotificationItem[]}>()
  for (const n of items) {
    if (!map.has(n.type)) {
      map.set(n.type, {representative: n, all: [n]})
    } else {
      map.get(n.type)!.all.push(n)
    }
  }
  return Array.from(map.values())
}

// ─── Panel ───────────────────────────────────────────────

export function NotificationsPanel() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeNotifications, setActiveNotifications] = useState<NotificationItem[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [enabledTypes, setEnabledTypes] = useState<Set<string> | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/notifications/subscriptions')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setEnabledTypes(new Set(d.subscriptions.filter((s: {type: string; enabled: boolean}) => s.enabled).map((s: {type: string; enabled: boolean}) => s.type)))
      })
      .catch(() => {})
  }, [])

  // Filter raw items by enabled subscription types before any grouping
  const visibleItems = useMemo(
    () => enabledTypes ? items.filter((n) => enabledTypes.has(n.type)) : items,
    [items, enabledTypes],
  )

  // Split items into active (show in panel) and archived (read + older than 3 days)
  const {activeItems, archivedItems} = useMemo(() => {
    const now = Date.now()
    const active: NotificationItem[] = []
    const archived: NotificationItem[] = []
    for (const n of visibleItems) {
      const isOld = now - new Date(n.createdAt).getTime() > OLD_THRESHOLD_MS
      if (n.isRead && isOld) {
        archived.push(n)
      } else {
        active.push(n)
      }
    }
    return {activeItems: active, archivedItems: archived}
  }, [visibleItems])

  const grouped = useMemo(() => buildGroups(activeItems), [activeItems])
  const archivedGrouped = useMemo(() => buildGroups(archivedItems), [archivedItems])

  // Badge: sum of group sizes for groups with unread items
  const badgeCount = useMemo(
    () => grouped.reduce((sum, {all}) => (all.some((n) => !n.isRead) ? sum + all.length : sum), 0),
    [grouped],
  )

  const fetchPage = useCallback(async (p: number, replace = false) => {
    try {
      const res = await fetch(`/api/notifications?page=${p}&limit=${PAGE_SIZE}`)
      if (!res.ok) return
      const data = await res.json()
      setItems((prev) => replace ? data.items : [...prev, ...data.items])
      setUnreadCount(data.unreadCount)
      setHasMore(p < data.totalPages)
      setPage(p)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPage(1, true).finally(() => setLoading(false))
  }, [fetchPage])

  useEffect(() => {
    const id = setInterval(() => fetchPage(1, true), 60_000)
    return () => clearInterval(id)
  }, [fetchPage])

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || !hasMore || loadingMore) return
        setLoadingMore(true)
        await fetchPage(page + 1)
        setLoadingMore(false)
      },
      {threshold: 0.1, root: listRef.current}
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, page, fetchPage])

  // Mark given ids as read (optimistic)
  const handleMarkRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const readCount = ids.filter((id) => {
      const n = items.find((x) => x.id === id)
      return n && !n.isRead
    }).length
    setItems((prev) => prev.map((n) => idSet.has(n.id) ? {...n, isRead: true} : n))
    setUnreadCount((c) => Math.max(0, c - readCount))
    setActiveNotifications((prev) =>
      prev ? prev.map((n) => idSet.has(n.id) ? {...n, isRead: true} : n) : null
    )
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids}),
    }).catch(() => {})
  }, [items])

  // Mark all read
  const handleMarkAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({...n, isRead: true})))
    setUnreadCount(0)
    setActiveNotifications((prev) => prev ? prev.map((n) => ({...n, isRead: true})) : null)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({all: true}),
    }).catch(() => {})
  }, [])

  const handleOpenGroup = useCallback((notifications: NotificationItem[]) => {
    setActiveNotifications(notifications)
  }, [])

  return (
    <>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.header_left}>
            <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='#141416' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
              <path d='M13.73 21a2 2 0 0 1-3.46 0' />
            </svg>
            <span className={styles.header_title}>Уведомления</span>
            {badgeCount > 0 && (
              <span className={styles.badge}>{badgeCount > 99 ? '99+' : badgeCount}</span>
            )}
          </div>
          <button
            className={styles.mark_all_btn}
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Прочитать всё
          </button>
        </div>

        {/* List */}
        <div className={styles.list} ref={listRef}>
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : grouped.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {grouped.map(({representative, all}) => (
                <RowNotification
                  key={representative.type}
                  item={representative}
                  count={all.length}
                  allItems={all}
                  onOpen={handleOpenGroup}
                />
              ))}
              {hasMore && <div ref={sentinelRef} className={styles.sentinel} />}
              {loadingMore && (
                <div className={styles.loading_more}>
                  <div className={styles.spinner} />
                </div>
              )}
            </>
          )}
        </div>

        {/* History footer */}
        {archivedItems.length > 0 && (
          <div className={styles.history_footer}>
            <button className={styles.history_btn} onClick={() => setHistoryOpen(true)}>
              <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <circle cx='12' cy='12' r='10' />
                <polyline points='12 6 12 12 16 14' />
              </svg>
              История ({archivedItems.length})
            </button>
          </div>
        )}

        {/* View all */}
        <div className={styles.view_all_footer}>
          <Link href='/notifications' className={styles.view_all_btn}>
            Смотреть все уведомления
          </Link>
        </div>
      </div>

      {/* History modal */}
      <ModalWindowDefault
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        additionalTitle={<span style={{fontWeight: 700, fontSize: 15}}>История уведомлений</span>}
      >
        <div className={styles.history_list}>
          {archivedGrouped.map(({representative, all}) => (
            <RowNotification
              key={representative.type}
              item={representative}
              count={all.length}
              allItems={all}
              onOpen={(notifications) => {
                setHistoryOpen(false)
                handleOpenGroup(notifications)
              }}
            />
          ))}
        </div>
      </ModalWindowDefault>

      {/* Detail modal */}
      <NotificationDetailModal
        notifications={activeNotifications ?? []}
        isOpen={activeNotifications !== null}
        onClose={() => setActiveNotifications(null)}
        onMarkRead={handleMarkRead}
      />
    </>
  )
}
