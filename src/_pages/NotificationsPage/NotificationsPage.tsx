'use client'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useLocale, useTranslations} from 'next-intl'
import {useThemeCtx} from '@/app/providers/ThemeContext'
import {NavBar} from '@/widgets/BaseUI'
import {NotificationItem, TYPE_CONFIG, FALLBACK_CONFIG, relativeTime} from '@/widgets/NotificationsPanel/RowNotification'
import {NotificationDetailModal} from '@/widgets/NotificationsPanel/NotificationDetailModal'
import {toast} from 'sonner'
import styles from './NotificationsPage.module.scss'

// ─── Constants ────────────────────────────────────────────

const PAGE_SIZE = 30
const OLD_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000

type StatusTab = 'all' | 'unread' | 'archive'
const STATUS_TAB_KEYS: StatusTab[] = ['all', 'unread', 'archive']

const TYPE_KEYS = [
  'NEW_COMPLAINT',
  'COMPLAINT_REPLIED',
  'COMPLAINT_CLOSED',
  'NEW_STUDENT',
  'ROADMAP_PURCHASE',
  'NEW_COMMENT_ON_POST',
  'NEW_REVIEW',
  'NEW_POST',
  'VIDEO_CALL_INVITE',
  'PERSONAL_SERVICE',
  'BOOKING_RESPONSE',
  'SERVICE_BOOKING',
  'SYSTEM',
] as const

// ─── Heatmap helpers ──────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function heatColor(count: number, isDark: boolean): string {
  if (count === 0) return isDark ? 'rgba(255,255,255,0.06)' : '#eaecef'
  if (count <= 2)  return '#c4b5fd'
  if (count <= 5)  return '#8b5cf6'
  if (count <= 9)  return '#6366f1'
  return '#4338ca'
}

// 4 calendar months ending at current month, shifted by offset pages (each page = 4 months)
function getMonthRange(offset: number): {year: number; month: number}[] {
  const now = new Date()
  return Array.from({length: 4}, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset * 4 - (3 - i), 1)
    return {year: d.getFullYear(), month: d.getMonth()}
  })
}

// All Mon–Sun weeks that overlap with the given calendar month
function getMonthWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const endDow   = (last.getDay()  + 6) % 7
  let cur = addDays(first, -startDow)
  const end = addDays(last, 6 - endDow)
  const weeks: Date[][] = []
  while (cur <= end) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur = addDays(cur, 1) }
    weeks.push(week)
  }
  return weeks
}

// ─── Notification settings ────────────────────────────────

type SubEntry = {type: string; enabled: boolean}

function NotificationSettings({
  subs,
  onToggle,
}: {
  subs: SubEntry[]
  onToggle: (type: string, next: boolean) => void
}) {
  const t = useTranslations('notifications')
  if (subs.length === 0) return null

  return (
    <div className={styles.settings_wrap}>
      <p className={styles.settings_title}>{t('showInPanel')}</p>
      <div className={styles.settings_list}>
        {subs.map(({type, enabled}) => {
          const cfg = TYPE_CONFIG[type] ?? FALLBACK_CONFIG
          const isSystem = type === 'SYSTEM'
          const typeLabel = TYPE_KEYS.includes(type as typeof TYPE_KEYS[number])
            ? t(`types.${type}` as Parameters<typeof t>[0])
            : type
          return (
            <div key={type} className={styles.settings_row}>
              <div className={styles.settings_icon} style={{background: cfg.bg, color: cfg.color}}>
                {cfg.icon}
              </div>
              <span className={styles.settings_label}>{typeLabel}</span>
              {isSystem ? (
                <span className={styles.settings_always_on}>{t('alwaysOn')}</span>
              ) : (
                <button
                  className={`${styles.settings_toggle} ${enabled ? styles.settings_toggle_on : ''}`}
                  onClick={() => onToggle(type, !enabled)}
                  aria-pressed={enabled}
                  aria-label={`${typeLabel}: ${enabled ? 'on' : 'off'}`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Heatmap component ────────────────────────────────────

function NotificationHeatmap({onDayClick, enabledTypes}: {onDayClick: (date: string) => void; enabledTypes: Set<string> | null}) {
  const t = useTranslations('notifications')
  const locale = useLocale()
  const {isDark} = useThemeCtx()
  const [days, setDays] = useState<Record<string, number>>({})
  const [tooltip, setTooltip] = useState<{date: string; count: number; x: number; y: number} | null>(null)
  const [monthOffset, setMonthOffset] = useState(0) // 0 = current 4 months
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Wait until subscriptions are loaded; null = loading
    if (enabledTypes === null) return
    const typesParam = enabledTypes.size > 0
      ? `&types=${Array.from(enabledTypes).join(',')}`
      : ''
    fetch(`/api/notifications/stats?weeks=52${typesParam}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setDays(d.days))
      .catch(() => {})
  }, [enabledTypes])

  const monthData = useMemo(() =>
    getMonthRange(monthOffset).map(({year, month}) => ({
      year, month,
      weeks: getMonthWeeks(year, month),
    })),
  [monthOffset])

  const today = toISO(new Date())

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, date: string, count: number) => {
    if (!gridRef.current) return
    const rect    = e.currentTarget.getBoundingClientRect()
    const gridRect = gridRef.current.getBoundingClientRect()
    setTooltip({date, count, x: rect.left - gridRect.left + rect.width / 2, y: rect.top - gridRect.top})
  }

  return (
    <div className={styles.heatmap_wrap}>
      <div className={styles.heatmap_header}>
        <p className={styles.heatmap_title}>{t('activity')}</p>
        <div className={styles.heatmap_nav}>
          <button className={styles.heatmap_nav_btn} onClick={() => setMonthOffset((o) => o + 1)} aria-label={locale === 'en' ? 'Back' : 'Назад'}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><path d='M15 18l-6-6 6-6'/></svg>
          </button>
          <button className={styles.heatmap_nav_btn} onClick={() => setMonthOffset((o) => Math.max(0, o - 1))} disabled={monthOffset === 0} aria-label={locale === 'en' ? 'Forward' : 'Вперёд'}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><path d='M9 18l6-6-6-6'/></svg>
          </button>
        </div>
      </div>

      {/* Grid: DOW column + 4 month groups */}
      <div ref={gridRef} className={styles.heatmap_grid}>
        {/* Day-of-week labels */}
        <div className={styles.heatmap_dow_col}>
          <div className={styles.heatmap_name_spacer} />
          <div className={styles.heatmap_dow_labels}>
            {Array.from({length: 7}, (_, i) => {
              // Monday-first: day 0 = Monday (weekday index 1 in ISO)
              const date = new Date(2024, 0, 1 + i) // Jan 1 2024 is Monday
              const label = date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {weekday: 'short'}).slice(0, 2)
              return (
                <span key={i} className={styles.heatmap_dow_label}>{i % 2 === 0 ? label : ''}</span>
              )
            })}
          </div>
        </div>

        {/* Month groups */}
        <div className={styles.heatmap_months_area}>
          {monthData.map(({year, month, weeks}, mi) => (
            <div key={`${year}-${month}`} className={`${styles.heatmap_month_group} ${mi > 0 ? styles.heatmap_month_sep : ''}`}>
              <div className={styles.heatmap_month_name}>{new Date(year, month, 1).toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {month: 'short'})}</div>
              <div className={styles.heatmap_weeks}>
                {weeks.map((week, wi) => (
                  <div key={wi} className={styles.heatmap_col}>
                    {week.map((day, di) => {
                      const iso = toISO(day)
                      const count = days[iso] ?? 0
                      const isFuture = iso > today
                      const isOtherMonth = day.getMonth() !== month
                      return (
                        <div
                          key={di}
                          className={`${styles.heatmap_cell} ${isFuture || isOtherMonth ? styles.heatmap_cell_dim : count > 0 ? styles.heatmap_cell_clickable : ''}`}
                          style={{background: isFuture || isOtherMonth ? 'transparent' : heatColor(count, isDark)}}
                          onClick={() => !isFuture && !isOtherMonth && count > 0 && onDayClick(iso)}
                          onMouseEnter={(e) => !isFuture && !isOtherMonth && handleMouseEnter(e, iso, count)}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tooltip — absolute inside gridRef */}
        {tooltip && (
          <div className={styles.heatmap_tooltip} style={{left: tooltip.x, top: tooltip.y}}>
            <span className={styles.tooltip_date}>
              {new Date(tooltip.date + 'T12:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {day: 'numeric', month: 'long'})}
            </span>
            <span className={styles.tooltip_count}>
              {tooltip.count === 0 ? t('noNotifOnDay') : t('notifsOnDay', {count: tooltip.count})}
            </span>
          </div>
        )}
      </div>

      <div className={styles.heatmap_legend}>
        <span className={styles.legend_label}>{t('less')}</span>
        {['#eaecef', '#c4b5fd', '#8b5cf6', '#6366f1', '#4338ca'].map((c) => (
          <div key={c} className={styles.legend_cell} style={{background: c}} />
        ))}
        <span className={styles.legend_label}>{t('more')}</span>
      </div>
    </div>
  )
}

// ─── Full notification row ────────────────────────────────

function NotificationPageRow({item, onMarkRead, onOpen}: {item: NotificationItem; onMarkRead: (id: string) => void; onOpen: (item: NotificationItem) => void}) {
  const router = useRouter()
  const t = useTranslations('notifications')
  const locale = useLocale()
  const cfg = TYPE_CONFIG[item.type] ?? FALLBACK_CONFIG
  const payload     = item.payload ?? {}
  const actorId     = payload.actorId     as string | undefined
  const actorName   = payload.actorName   as string | undefined
  const actorRole   = payload.actorRole   as string | undefined
  const complaintId = payload.complaintId as string | undefined
  const href = cfg.getHref?.(payload) ?? null
  const canReply = item.type === 'NEW_COMPLAINT' && !!complaintId

  const [expanded, setExpanded]   = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending]     = useState(false)
  const [replied, setReplied]     = useState(false)

  const handleRowClick = () => {
    onMarkRead(item.id)
    onOpen(item)
  }

  const handleReply = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!replyText.trim() || !complaintId) return
    setSending(true)
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reply: replyText.trim()}),
      })
      if (!res.ok) throw new Error()
      toast.success(t('replySuccess'))
      setReplied(true)
      setExpanded(false)
      setReplyText('')
    } catch {
      toast.error(t('replyError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className={`${styles.row} ${!item.isRead ? styles.row_unread : ''} ${expanded ? styles.row_expanded : ''}`}
      style={{'--accent': cfg.color} as React.CSSProperties}
    >
      <div className={styles.accent_bar} />
      <div className={styles.row_top} onClick={handleRowClick} role='button' tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}>
        <div className={styles.icon_wrap} style={{background: cfg.bg, color: cfg.color}}>{cfg.icon}</div>
        <div className={styles.row_content}>
          <div className={styles.title_row}>
            <span className={styles.title}>{item.title}</span>
            <span className={styles.time}>{relativeTime(item.createdAt, locale)}</span>
          </div>
          {item.type === 'SYSTEM' && payload.html
            ? <div className={styles.body} dangerouslySetInnerHTML={{__html: payload.html as string}} />
            : item.body && <p className={styles.body}>{item.body}</p>
          }
          {!cfg.hideActor && actorId && actorName && (
            <Link href={`/user/${actorId}`} className={styles.actor_chip} style={{color: cfg.color}} onClick={(e) => e.stopPropagation()}>
              <span className={styles.actor_avatar} style={{background: cfg.color + '22', color: cfg.color}}>
                {actorName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className={styles.actor_name}>{actorName}</span>
              {actorRole === 'STUDENT' && <span className={styles.actor_role}>{t('roleStudent')}</span>}
              {actorRole === 'TEACHER' && <span className={styles.actor_role}>{t('roleTeacher')}</span>}
            </Link>
          )}
          <div className={styles.actions_row}>
            {cfg.actionLabel && href && (
              <button className={styles.action_btn} style={{color: cfg.color}} onClick={(e) => {e.stopPropagation(); router.push(href)}}>
                {cfg.actionLabel}
                <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M5 12h14M12 5l7 7-7 7' />
                </svg>
              </button>
            )}
            {canReply && !replied && (
              <button className={styles.reply_toggle} style={{color: cfg.color}} onClick={(e) => {e.stopPropagation(); onMarkRead(item.id); setExpanded((p) => !p)}}>
                <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                  <polyline points='9 17 4 12 9 7'/><path d='M20 18v-2a4 4 0 0 0-4-4H4'/>
                </svg>
                {expanded ? t('collapseReply') : t('reply')}
              </button>
            )}
            {replied && <span className={styles.replied_badge}>{t('replied')}</span>}
          </div>
        </div>
        {!item.isRead && <div className={styles.unread_dot} style={{background: cfg.color}} />}
        {canReply && !replied && (
          <svg className={`${styles.chevron} ${expanded ? styles.chevron_open : ''}`} width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#bbb' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <polyline points='6 9 12 15 18 9'/>
          </svg>
        )}
      </div>
      {expanded && canReply && (
        <div className={styles.reply_section} onClick={(e) => e.stopPropagation()}>
          <textarea className={styles.reply_textarea} rows={3} placeholder={t('replyPlaceholder')} value={replyText} onChange={(e) => setReplyText(e.target.value)} disabled={sending} autoFocus />
          <div className={styles.reply_footer}>
            <button className={styles.reply_cancel} onClick={() => setExpanded(false)} disabled={sending}>{t('cancel')}</button>
            <button className={styles.reply_submit} style={{background: cfg.color}} onClick={handleReply} disabled={sending || !replyText.trim()}>
              {sending ? t('sending') : t('sendReply')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeleton_icon} />
      <div className={styles.skeleton_lines}>
        <div className={styles.skeleton_line_a} />
        <div className={styles.skeleton_line_b} />
        <div className={styles.skeleton_line_c} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

export function NotificationsPage() {
  const t = useTranslations('notifications')
  const locale = useLocale()
  const [items, setItems]             = useState<NotificationItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage]               = useState(1)
  const [hasMore, setHasMore]         = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [statusTab, setStatusTab]     = useState<StatusTab>('all')
  const [typeFilter, setTypeFilter]   = useState<string>('all')

  // Subscriptions — shared between settings card and heatmap
  const [subs, setSubs] = useState<SubEntry[]>([])
  const enabledTypes = useMemo<Set<string> | null>(
    () => subs.length > 0 ? new Set(subs.filter((s) => s.enabled).map((s) => s.type)) : null,
    [subs],
  )

  const handleSubToggle = useCallback(async (type: string, next: boolean) => {
    setSubs((prev) => prev.map((s) => s.type === type ? {...s, enabled: next} : s))
    await fetch('/api/notifications/subscriptions', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({updates: [{type, enabled: next}]}),
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/notifications/subscriptions')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSubs(d.subscriptions) })
      .catch(() => {})
  }, [])

  // Row detail modal (single notification click)
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null)

  // Day-detail modal
  const [dayDate, setDayDate]         = useState<string | null>(null)
  const [dayItems, setDayItems]       = useState<NotificationItem[]>([])
  const [dayLoading, setDayLoading]   = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (p: number, replace = false) => {
    try {
      const res = await fetch(`/api/notifications?page=${p}&limit=${PAGE_SIZE}&lang=${locale}`)
      if (!res.ok) return
      const data = await res.json()
      setItems((prev) => replace ? data.items : [...prev, ...data.items])
      setUnreadCount(data.unreadCount)
      setHasMore(p < data.totalPages)
      setPage(p)
    } catch {/* ignore */}
  }, [locale])

  useEffect(() => {
    setLoading(true)
    fetchPage(1, true).finally(() => setLoading(false))
  }, [fetchPage])

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
      {threshold: 0.1}
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, page, fetchPage])

  const markRead = useCallback(async (id: string) => {
    const n = items.find((x) => x.id === id)
    if (!n || n.isRead) return
    setItems((prev) => prev.map((x) => x.id === id ? {...x, isRead: true} : x))
    setUnreadCount((c) => Math.max(0, c - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids: [id]}),
    }).catch(() => {})
  }, [items])

  const handleMarkAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({...n, isRead: true})))
    setUnreadCount(0)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({all: true}),
    }).catch(() => {})
  }, [])

  // Open day detail modal
  const handleDayClick = useCallback(async (date: string) => {
    setDayDate(date)
    setDayLoading(true)
    try {
      const res = await fetch(`/api/notifications?date=${date}&limit=50&lang=${locale}`)
      if (res.ok) {
        const data = await res.json()
        setDayItems(data.items ?? [])
      }
    } catch {/* ignore */}
    setDayLoading(false)
  }, [])

  const {activeItems, archivedItems} = useMemo(() => {
    const now = Date.now()
    const active: NotificationItem[] = []
    const archived: NotificationItem[] = []
    for (const n of items) {
      if (n.isRead && now - new Date(n.createdAt).getTime() > OLD_THRESHOLD_MS) {
        archived.push(n)
      } else {
        active.push(n)
      }
    }
    return {activeItems: active, archivedItems: archived}
  }, [items])

  const statusFiltered = useMemo(() => {
    if (statusTab === 'archive') return archivedItems
    if (statusTab === 'unread')  return activeItems.filter((n) => !n.isRead)
    return activeItems
  }, [statusTab, activeItems, archivedItems])

  const availableTypes = useMemo(() => {
    const set = new Set(statusFiltered.map((n) => n.type))
    return Array.from(set).filter((type) => TYPE_KEYS.includes(type as typeof TYPE_KEYS[number]))
  }, [statusFiltered])

  const displayItems = useMemo(() => {
    if (typeFilter === 'all') return statusFiltered
    return statusFiltered.filter((n) => n.type === typeFilter)
  }, [statusFiltered, typeFilter])

  const badgeCount = useMemo(() => activeItems.filter((n) => !n.isRead).length, [activeItems])

  const handleStatusTab = (t: StatusTab) => {
    setStatusTab(t)
    setTypeFilter('all')
  }

  return (
    <>
      <div className={`container default_content ${styles.wrap}`}>
        <NavBar />

        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.header_left}>
              <h1 className={styles.title}>{t('title')}</h1>
              {badgeCount > 0 && <span className={styles.badge}>{badgeCount > 99 ? '99+' : badgeCount}</span>}
            </div>
            <button className={styles.mark_all_btn} onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              {t('markAllRead')}
            </button>
          </div>

          <div className={styles.inner}>
            {/* Left: list */}
            <div className={styles.list_col}>
              {/* Status tabs */}
              <div className={styles.tabs}>
                {STATUS_TAB_KEYS.map((key) => (
                  <button key={key} className={`${styles.tab} ${statusTab === key ? styles.tab_active : ''}`} onClick={() => handleStatusTab(key)}>
                    {t(`tabs.${key}` as Parameters<typeof t>[0])}
                    {key === 'unread'  && unreadCount > 0          && <span className={styles.tab_badge}>{unreadCount}</span>}
                    {key === 'archive' && archivedItems.length > 0  && <span className={styles.tab_badge}>{archivedItems.length}</span>}
                  </button>
                ))}
              </div>

              {/* Type filters */}
              {availableTypes.length > 1 && (
                <div className={styles.type_filters}>
                  <button className={`${styles.type_chip} ${typeFilter === 'all' ? styles.type_chip_active : ''}`} onClick={() => setTypeFilter('all')}>
                    {t('allTypes')}
                  </button>
                  {availableTypes.map((type) => {
                    const cfg = TYPE_CONFIG[type] ?? FALLBACK_CONFIG
                    const active = typeFilter === type
                    const typeLabel = TYPE_KEYS.includes(type as typeof TYPE_KEYS[number])
                      ? t(`types.${type}` as Parameters<typeof t>[0])
                      : type
                    return (
                      <button key={type} className={`${styles.type_chip} ${active ? styles.type_chip_active : ''}`}
                        style={active ? {background: cfg.color + '18', color: cfg.color, borderColor: cfg.color + '44'} : {}}
                        onClick={() => setTypeFilter(type)}
                      >
                        <span className={styles.type_chip_dot} style={{background: cfg.color}} />
                        {typeLabel}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Notification list */}
              <div className={styles.list}>
                {loading ? (
                  Array.from({length: 5}).map((_, i) => <SkeletonRow key={i} />)
                ) : displayItems.length === 0 ? (
                  <div className={styles.empty}>
                    <svg width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='#d1d5db' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
                      <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/>
                      <path d='M13.73 21a2 2 0 0 1-3.46 0'/>
                    </svg>
                    <p>{statusTab === 'unread' ? t('noUnread') : statusTab === 'archive' ? t('archiveEmpty') : t('empty')}</p>
                  </div>
                ) : (
                  <>
                    {displayItems.map((item) => (
                      <NotificationPageRow key={item.id} item={item} onMarkRead={markRead} onOpen={setSelectedItem} />
                    ))}
                    {hasMore && <div ref={sentinelRef} style={{height: 1}} />}
                    {loadingMore && <div className={styles.spinner_wrap}><div className={styles.spinner} /></div>}
                  </>
                )}
              </div>
            </div>

            {/* Right: heatmap */}
            <div className={styles.heatmap_panel}>
              <NotificationHeatmap onDayClick={handleDayClick} enabledTypes={enabledTypes} />
              <NotificationSettings subs={subs} onToggle={handleSubToggle} />
            </div>
          </div>
        </div>
      </div>

      {/* Single notification detail modal */}
      <NotificationDetailModal
        notifications={selectedItem ? [selectedItem] : []}
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        onMarkRead={async (ids) => {
          const idSet = new Set(ids)
          setSelectedItem((prev) => prev && idSet.has(prev.id) ? {...prev, isRead: true} : prev)
          setItems((prev) => prev.map((n) => idSet.has(n.id) ? {...n, isRead: true} : n))
          await fetch('/api/notifications', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids})}).catch(() => {})
        }}
      />

      {/* Day-detail modal */}
      <NotificationDetailModal
        notifications={dayItems}
        isOpen={dayDate !== null}
        onClose={() => {setDayDate(null); setDayItems([])}}
        onMarkRead={async (ids) => {
          const idSet = new Set(ids)
          setDayItems((prev) => prev.map((n) => idSet.has(n.id) ? {...n, isRead: true} : n))
          setItems((prev) => prev.map((n) => idSet.has(n.id) ? {...n, isRead: true} : n))
          await fetch('/api/notifications', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids})}).catch(() => {})
        }}
      />
      {dayLoading && (
        <div className={styles.day_loading_overlay}>
          <div className={styles.spinner} />
        </div>
      )}
    </>
  )
}
