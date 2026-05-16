'use client'

import { NavBar } from '@/widgets/BaseUI'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import styles from './AdminPage.module.scss'

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
  post: { id: string; title: string } | null
  roadmap: { id: string; title: string } | null
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Ожидает',  color: '#f59e0b', bg: '#fffbeb' },
  answered: { label: 'Отвечено', color: '#6366f1', bg: '#eef2ff' },
  resolved: { label: 'Решено',   color: '#22c55e', bg: '#f0fdf4' },
  closed:   { label: 'Закрыто',  color: '#868897', bg: '#f7f7f7' },
}

const COMPLAINT_TABS = ['all', 'pending', 'answered', 'resolved', 'closed'] as const
type ComplaintTab = typeof COMPLAINT_TABS[number]
const COMPLAINT_TAB_LABELS: Record<ComplaintTab, string> = {
  all: 'Все', pending: 'Ожидает', answered: 'Отвечено', resolved: 'Решено', closed: 'Закрыто',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short', year: 'numeric' })
}

function targetLabel(c: ComplaintItem) {
  if (c.targetType === 'PLATFORM') return { label: 'Платформа', href: null, kind: 'Обратная связь' }
  if (c.post) return { label: c.post.title || 'Пост', href: `/post/${c.post.id}`, kind: 'Пост' }
  if (c.roadmap) return { label: c.roadmap.title || 'Роадмап', href: `/road-map/${c.roadmap.id}`, kind: 'Роадмап' }
  return { label: c.targetType, href: null, kind: c.targetType }
}

// ─── Complaint card ───────────────────────────────────────

function ComplaintCard({ item, onReplied }: { item: ComplaintItem; onReplied: (id: string, reply: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [statusValue, setStatusValue] = useState(item.status)
  const target = targetLabel(item)
  const activeCfg = STATUS_CFG[statusValue] ?? STATUS_CFG.pending

  const handleReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/complaints/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText.trim() }),
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setStatusValue(newStatus)
      toast.success('Статус обновлён')
    } catch {
      toast.error('Не удалось обновить статус')
    }
  }

  return (
    <div className={`${styles.card} ${expanded ? styles.card_expanded : ''}`}>
      <div className={styles.card_header} onClick={() => setExpanded(p => !p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setExpanded(p => !p)}>
        <div className={styles.card_meta}>
          <div className={styles.target_row}>
            <span className={styles.target_kind}>{target.kind}</span>
            {target.href ? (
              <Link href={target.href} className={styles.target_link} onClick={e => e.stopPropagation()}>{target.label}</Link>
            ) : (
              <span className={styles.target_label}>{target.label}</span>
            )}
          </div>
          <span className={styles.date}>{fmt(item.createdAt)}</span>
        </div>
        <div className={styles.card_right}>
          <span className={styles.status_badge} style={{ color: activeCfg.color, background: activeCfg.bg }}>{activeCfg.label}</span>
          {item.reply && <span className={styles.has_reply_dot} title="Есть ответ" />}
          <svg className={`${styles.chevron} ${expanded ? styles.chevron_open : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <p className={styles.text_preview}>{item.text.length > 120 ? item.text.slice(0, 120) + '…' : item.text}</p>

      {expanded && (
        <div className={styles.card_body}>
          <div className={styles.divider} />

          <div className={styles.section}>
            <p className={styles.section_label}>Жалоба</p>
            <p className={styles.full_text}>{item.text}</p>
            <p className={styles.reporter_meta}>
              От: <span>{item.reporterRole === 'STUDENT' ? 'ученик' : item.reporterRole === 'TEACHER' ? 'учитель' : 'пользователь'}</span>
              {' · '}ID {item.reporterId.slice(0, 8)}…
            </p>
          </div>

          {item.reply && (
            <div className={styles.section}>
              <p className={styles.section_label}>Ответ</p>
              <div className={styles.reply_bubble}>
                <p>{item.reply}</p>
                {item.repliedAt && <span className={styles.reply_date}>{fmt(item.repliedAt)}</span>}
              </div>
            </div>
          )}

          {!item.reply && (
            <div className={styles.section}>
              <p className={styles.section_label}>Написать ответ</p>
              <div className={styles.reply_input_row}>
                <textarea className={styles.reply_textarea} rows={3} placeholder="Ваш ответ…" value={replyText} onChange={e => setReplyText(e.target.value)} disabled={sending} />
                <button className={styles.reply_btn} onClick={handleReply} disabled={sending || !replyText.trim()}>
                  {sending ? 'Отправка…' : 'Отправить'}
                </button>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <p className={styles.section_label}>Статус</p>
            <div className={styles.status_row}>
              {Object.entries(STATUS_CFG).map(([key, s]) => (
                <button
                  key={key}
                  className={`${styles.status_chip} ${statusValue === key ? styles.status_chip_active : ''}`}
                  style={statusValue === key ? { color: s.color, background: s.bg, borderColor: s.color + '44' } : {}}
                  onClick={() => handleStatusChange(key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Complaints tab ───────────────────────────────────────

const PAGE_SIZE = 15

function ComplaintsTab() {
  const [tab, setTab] = useState<ComplaintTab>('all')
  const [items, setItems] = useState<ComplaintItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (p: number, status: string, replace = false) => {
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
    if (status !== 'all') params.set('status', status)
    const res = await fetch(`/api/complaints?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setItems(prev => replace ? data.items : [...prev, ...data.items])
    setTotal(data.total ?? 0)
    setHasMore(p < data.totalPages)
    setPage(p)
  }, [])

  useEffect(() => {
    setLoading(true)
    setItems([])
    fetchPage(1, tab, true).finally(() => setLoading(false))
  }, [tab, fetchPage])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || !hasMore || loadingMore) return
      setLoadingMore(true)
      await fetchPage(page + 1, tab)
      setLoadingMore(false)
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, page, tab, fetchPage])

  const handleReplied = useCallback((id: string, reply: string) => {
    setItems(prev => prev.map(c => c.id === id ? { ...c, reply, repliedAt: new Date().toISOString(), status: 'answered' } : c))
  }, [])

  return (
    <div className={styles.tab_content}>
      <div className={styles.tab_header}>
        <div className={styles.filter_tabs}>
          {COMPLAINT_TABS.map(t => (
            <button key={t} className={`${styles.filter_tab} ${tab === t ? styles.filter_tab_active : ''}`} onClick={() => setTab(t)}>
              {COMPLAINT_TAB_LABELS[t]}
            </button>
          ))}
        </div>
        {total > 0 && <span className={styles.total_badge}>{total}</span>}
      </div>

      <div className={styles.list}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p>Жалоб нет</p>
          </div>
        ) : (
          items.map(item => <ComplaintCard key={item.id} item={item} onReplied={handleReplied} />)
        )}
        {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
        {loadingMore && <div className={styles.spinner_wrap}><div className={styles.spinner} /></div>}
      </div>
    </div>
  )
}

// ─── Notifications tab ────────────────────────────────────

const TARGET_OPTIONS = [
  { value: 'all', label: 'Все пользователи' },
  { value: 'students', label: 'Только ученики' },
  { value: 'teachers', label: 'Только учителя' },
]

function NotificationsTab() {
  const [target, setTarget] = useState<'all' | 'students' | 'teachers'>('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [html, setHtml] = useState('')
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState<{ created: number } | null>(null)

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Укажите заголовок и текст')
      return
    }
    setSending(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, title, body, html: html || undefined }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLastResult(data)
      toast.success(`Отправлено ${data.created} уведомлений`)
      setTitle('')
      setBody('')
      setHtml('')
    } catch {
      toast.error('Не удалось отправить уведомления')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.tab_content}>
      <div className={styles.notif_form}>
        <p className={styles.notif_desc}>
          Создайте системное уведомление и разошлите его выбранной аудитории.
          Пользователи увидят его в разделе «Уведомления».
        </p>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>Аудитория</label>
          <div className={styles.target_row}>
            {TARGET_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`${styles.target_chip} ${target === opt.value ? styles.target_chip_active : ''}`}
                onClick={() => setTarget(opt.value as typeof target)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>Заголовок</label>
          <input
            className={styles.notif_input}
            type="text"
            placeholder="Например: Важное обновление"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={sending}
          />
        </div>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>Текст уведомления</label>
          <textarea
            className={styles.notif_textarea}
            rows={3}
            placeholder="Краткое описание..."
            value={body}
            onChange={e => setBody(e.target.value)}
            disabled={sending}
          />
        </div>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>
            HTML-содержимое <span className={styles.notif_optional}>(необязательно — для расширенного отображения)</span>
          </label>
          <textarea
            className={styles.notif_textarea}
            rows={4}
            placeholder="<p>Расширенный текст уведомления...</p>"
            value={html}
            onChange={e => setHtml(e.target.value)}
            disabled={sending}
          />
        </div>

        <div className={styles.notif_actions}>
          <button className={styles.send_btn} onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}>
            {sending ? 'Отправка…' : 'Отправить уведомление'}
          </button>
          {lastResult && (
            <span className={styles.send_success}>
              ✓ Отправлено {lastResult.created} получателям
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

type AdminTab = 'complaints' | 'notifications'

export function AdminPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<AdminTab>('complaints')

  if (status === 'loading') {
    return (
      <div className={`container default_content ${styles.page_wrap}`}>
        <NavBar />
        <div className={styles.loading}>Загрузка…</div>
      </div>
    )
  }

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className={`container default_content ${styles.page_wrap}`}>
        <NavBar />
        <div className={styles.forbidden}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <p>Доступ запрещён</p>
          <span>Эта страница доступна только администраторам.</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`container default_content ${styles.page_wrap}`}>
      <NavBar />
      <div className={styles.content}>
        <div className={styles.page_header}>
          <h1 className={styles.page_title}>Администрирование</h1>
        </div>

        <div className={styles.main_tabs}>
          <button
            className={`${styles.main_tab} ${activeTab === 'complaints' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('complaints')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Жалобы и обратная связь
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'notifications' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Уведомления
          </button>
        </div>

        {activeTab === 'complaints' && <ComplaintsTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  )
}
