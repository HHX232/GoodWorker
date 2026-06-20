'use client'
import {NavBar} from '@/widgets/BaseUI'
import {useThemeCtx} from '@/app/providers/ThemeContext'
import {useSession} from 'next-auth/react'
import Link from 'next/link'
import {useCallback, useEffect, useRef, useState} from 'react'
import {toast} from 'sonner'
import styles from './ComplaintsPage.module.scss'

// ─── Types ────────────────────────────────────────────────

interface ComplaintItem {
  id: string
  status: string
  text: string
  reply: string | null
  repliedAt: string | null
  createdAt: string
  targetType: string
  targetId: string
  roadmapId: string | null
  postId: string | null
  reporterId: string
  reporterRole: string
  post: {id: string; title: string} | null
  roadmap: {id: string; title: string} | null
}

// ─── Status config ────────────────────────────────────────

const STATUS_CFG: Record<string, {label: string; color: string; bg: string; darkColor: string; darkBg: string}> = {
  pending:  {label: 'Ожидает',  color: '#f59e0b', bg: '#fffbeb', darkColor: '#fbbf24', darkBg: 'rgba(245,158,11,0.13)'},
  answered: {label: 'Отвечено', color: '#6366f1', bg: '#eef2ff', darkColor: '#818cf8', darkBg: 'rgba(99,102,241,0.13)'},
  resolved: {label: 'Решено',   color: '#22c55e', bg: '#f0fdf4', darkColor: '#4ade80', darkBg: 'rgba(34,197,94,0.13)'},
  closed:   {label: 'Закрыто',  color: '#868897', bg: '#f7f7f7', darkColor: 'rgba(255,255,255,0.35)', darkBg: 'rgba(255,255,255,0.07)'},
}

const TABS = ['all', 'pending', 'answered', 'resolved', 'closed'] as const
type Tab = typeof TABS[number]

const TAB_LABELS: Record<Tab, string> = {
  all: 'Все', pending: 'Ожидает', answered: 'Отвечено', resolved: 'Решено', closed: 'Закрыто',
}

// ─── Helpers ──────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ru', {day: '2-digit', month: 'short', year: 'numeric'})
}

function targetLabel(c: ComplaintItem) {
  if (c.post) return {label: c.post.title || 'Пост', href: `/post/${c.post.id}`, kind: 'Пост'}
  if (c.roadmap) return {label: c.roadmap.title || 'Роадмап', href: `/road-map/${c.roadmap.id}`, kind: 'Роадмап'}
  return {label: c.targetType, href: null, kind: c.targetType}
}

// ─── Complaint card ───────────────────────────────────────

function ComplaintCard({
  item,
  role,
  onReplied,
}: {
  item: ComplaintItem
  role: string
  onReplied: (id: string, reply: string) => void
}) {
  const {isDark} = useThemeCtx()
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [statusValue, setStatusValue] = useState(item.status)
  const target = targetLabel(item)
  const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.pending

  const canReply = (role === 'TEACHER' || role === 'ADMIN') && !item.reply
  const canChangeStatus = role === 'ADMIN'

  const handleReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/complaints/${item.id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reply: replyText.trim()}),
      })
      if (!res.ok) throw new Error()
      toast.success('Ответ отправлен')
      onReplied(item.id, replyText.trim())
      setReplyText('')
    } catch {
      toast.error('Не удалось отправить ответ')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/complaints/${item.id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status: newStatus}),
      })
      if (!res.ok) throw new Error()
      setStatusValue(newStatus)
      toast.success('Статус обновлён')
    } catch {
      toast.error('Не удалось обновить статус')
    }
  }

  const activeCfg = STATUS_CFG[statusValue] ?? STATUS_CFG.pending

  return (
    <div className={`${styles.card} ${expanded ? styles.card_expanded : ''}`}>
      {/* Card header */}
      <div className={styles.card_header} onClick={() => setExpanded((p) => !p)} role='button' tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setExpanded((p) => !p)}>
        <div className={styles.card_meta}>
          {/* Target */}
          <div className={styles.target_row}>
            <span className={styles.target_kind}>{target.kind}</span>
            {target.href ? (
              <Link href={target.href} className={styles.target_link} onClick={(e) => e.stopPropagation()}>
                {target.label}
              </Link>
            ) : (
              <span className={styles.target_label}>{target.label}</span>
            )}
          </div>
          <span className={styles.date}>{fmt(item.createdAt)}</span>
        </div>

        <div className={styles.card_right}>
          <span className={styles.status_badge} style={{color: isDark ? activeCfg.darkColor : activeCfg.color, background: isDark ? activeCfg.darkBg : activeCfg.bg}}>
            {activeCfg.label}
          </span>
          {item.reply && (
            <span className={styles.has_reply_dot} title='Есть ответ' />
          )}
          <svg
            className={`${styles.chevron} ${expanded ? styles.chevron_open : ''}`}
            width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#bbb' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'
          >
            <polyline points='6 9 12 15 18 9' />
          </svg>
        </div>
      </div>

      {/* Complaint text preview (always visible) */}
      <p className={styles.text_preview}>{item.text.length > 120 ? item.text.slice(0, 120) + '…' : item.text}</p>

      {/* Expanded body */}
      {expanded && (
        <div className={styles.card_body}>
          <div className={styles.divider} />

          {/* Full complaint text */}
          <div className={styles.section}>
            <p className={styles.section_label}>Жалоба</p>
            <p className={styles.full_text}>{item.text}</p>
            {(role === 'TEACHER' || role === 'ADMIN') && (
              <p className={styles.reporter_meta}>
                От: <span>{item.reporterRole === 'STUDENT' ? 'ученик' : 'учитель'}</span> · ID {item.reporterId.slice(0, 8)}…
              </p>
            )}
          </div>

          {/* Existing reply */}
          {item.reply && (
            <div className={styles.section}>
              <p className={styles.section_label}>Ответ</p>
              <div className={styles.reply_bubble}>
                <p>{item.reply}</p>
                {item.repliedAt && <span className={styles.reply_date}>{fmt(item.repliedAt)}</span>}
              </div>
            </div>
          )}

          {/* Reply input (teacher/admin, no existing reply yet) */}
          {canReply && (
            <div className={styles.section}>
              <p className={styles.section_label}>Написать ответ</p>
              <div className={styles.reply_input_row}>
                <textarea
                  className={styles.reply_textarea}
                  rows={3}
                  placeholder='Ваш ответ...'
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={sending}
                />
                <button
                  className={styles.reply_btn}
                  onClick={handleReply}
                  disabled={sending || !replyText.trim()}
                >
                  {sending ? 'Отправка…' : 'Отправить'}
                </button>
              </div>
            </div>
          )}

          {/* Admin status control */}
          {canChangeStatus && (
            <div className={styles.section}>
              <p className={styles.section_label}>Статус</p>
              <div className={styles.status_row}>
                {Object.entries(STATUS_CFG).map(([key, s]) => (
                  <button
                    key={key}
                    className={`${styles.status_chip} ${statusValue === key ? styles.status_chip_active : ''}`}
                    style={statusValue === key ? {color: isDark ? s.darkColor : s.color, background: isDark ? s.darkBg : s.bg, borderColor: (isDark ? s.darkColor : s.color) + '44'} : {}}
                    onClick={() => handleStatusChange(key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

const PAGE_SIZE = 15

export function ComplaintsPage() {
  const {data: session} = useSession()
  const role = session?.user?.role ?? ''

  const [tab, setTab] = useState<Tab>('all')
  const [items, setItems] = useState<ComplaintItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (p: number, status: string, replace = false) => {
    const params = new URLSearchParams({page: String(p), limit: String(PAGE_SIZE)})
    if (status !== 'all') params.set('status', status)
    const res = await fetch(`/api/complaints?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setItems((prev) => replace ? data.items : [...prev, ...data.items])
    setTotal(data.total ?? 0)
    setHasMore(p < data.totalPages)
    setPage(p)
  }, [])

  useEffect(() => {
    setLoading(true)
    setItems([])
    fetchPage(1, tab, true).finally(() => setLoading(false))
  }, [tab, fetchPage])

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || !hasMore || loadingMore) return
        setLoadingMore(true)
        await fetchPage(page + 1, tab)
        setLoadingMore(false)
      },
      {threshold: 0.1},
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, page, tab, fetchPage])

  const handleReplied = useCallback((id: string, reply: string) => {
    setItems((prev) => prev.map((c) => c.id === id ? {...c, reply, repliedAt: new Date().toISOString(), status: 'answered'} : c))
  }, [])

  return (
    <div className={`container default_content ${styles.page_wrap}`}>
      <NavBar />
      <div className={styles.content}>
        {/* Page header */}
        <div className={styles.page_header}>
          <h1 className={styles.page_title}>Жалобы</h1>
          {total > 0 && <span className={styles.total_badge}>{total}</span>}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tab_active : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* List */}
        <div className={styles.list} ref={listRef}>
          {loading ? (
            Array.from({length: 4}).map((_, i) => <div key={i} className={styles.skeleton} />)
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <svg width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='#d1d5db' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                <line x1='12' y1='9' x2='12' y2='13' /><line x1='12' y1='17' x2='12.01' y2='17' />
              </svg>
              <p>Жалоб нет</p>
            </div>
          ) : (
            items.map((item) => (
              <ComplaintCard
                key={item.id}
                item={item}
                role={role}
                onReplied={handleReplied}
              />
            ))
          )}

          {hasMore && <div ref={sentinelRef} style={{height: 1}} />}
          {loadingMore && <div className={styles.spinner_wrap}><div className={styles.spinner} /></div>}
        </div>
      </div>
    </div>
  )
}
