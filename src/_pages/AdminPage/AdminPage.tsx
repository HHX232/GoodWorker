'use client'

import { NavBar } from '@/widgets/BaseUI'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import styles from './AdminPage.module.scss'

// ─── Types ────────────────────────────────────────────────

interface UserItem {
  id: string
  name: string
  email: string
  role: 'TEACHER' | 'STUDENT'
  avatarUrl: string | null
  isVip: boolean
  vipExpiresAt: string | null
  isBanned: boolean
  bannedAt: string | null
  banReason: string | null
  createdAt: string
  lastSeenAt: string | null
  _count: { posts?: number; roadmaps?: number; teachers?: number; students?: number }
}

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
  const [markingValuable, setMarkingValuable] = useState(false)
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

  const handleMarkValuable = async () => {
    setMarkingValuable(true)
    try {
      const res = await fetch('/api/admin/feedback-valuable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId: item.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Уведомление о ценном отзыве отправлено')
    } catch {
      toast.error('Не удалось отправить уведомление')
    } finally {
      setMarkingValuable(false)
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

          {item.targetType === 'PLATFORM' && (
            <div className={styles.section}>
              <p className={styles.section_label}>Действия</p>
              <button
                className={styles.valuable_btn}
                onClick={handleMarkValuable}
                disabled={markingValuable}
              >
                {markingValuable ? 'Отправка…' : '⭐ Ценный отзыв — уведомить пользователя'}
              </button>
            </div>
          )}
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

interface NotifHistoryItem {
  id: string
  title: string
  body: string
  createdAt: string
  isRead: boolean
  teacher: { name: string } | null
  student: { name: string } | null
}

function NotificationsTab() {
  const [target, setTarget] = useState<'all' | 'students' | 'teachers'>('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [html, setHtml] = useState('')
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState<{ created: number } | null>(null)

  // Send to specific user
  const [userEmail, setUserEmail] = useState('')
  const [userTitle, setUserTitle] = useState('')
  const [userBody, setUserBody] = useState('')
  const [sendingUser, setSendingUser] = useState(false)

  // Telegram
  const [tgStats, setTgStats] = useState<{ students: number; teachers: number; total: number } | null>(null)
  const [tgMessage, setTgMessage] = useState('')
  const [tgSending, setTgSending] = useState(false)
  const [tgResult, setTgResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [tgTriggering, setTgTriggering] = useState(false)
  const [tgTriggerResult, setTgTriggerResult] = useState<{ conferences: number; sent: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/telegram').then(r => r.ok ? r.json() : null).then(d => d && setTgStats(d))
  }, [])

  const handleTgBroadcast = async () => {
    if (!tgMessage.trim()) return
    setTgSending(true)
    setTgResult(null)
    const toastId = toast.loading('Отправка Telegram-рассылки…')
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'broadcast', message: tgMessage.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка')
      setTgResult(data)
      toast.success(`Отправлено: ${data.sent} из ${data.total}`, { id: toastId })
      setTgMessage('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отправить', { id: toastId })
    } finally {
      setTgSending(false)
    }
  }

  const handleTgTrigger = async () => {
    setTgTriggering(true)
    setTgTriggerResult(null)
    const toastId = toast.loading('Запускаю напоминания…')
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', hoursFrom: 0, hoursTo: 48 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка')
      setTgTriggerResult(data)
      toast.success(`Уроков: ${data.conferences}, сообщений: ${data.sent}`, { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось запустить', { id: toastId })
    } finally {
      setTgTriggering(false)
    }
  }

  // History
  const [history, setHistory] = useState<NotifHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/notifications/history')
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.notifications ?? [])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

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
      loadHistory()
    } catch {
      toast.error('Не удалось отправить уведомления')
    } finally {
      setSending(false)
    }
  }

  const handleSendUser = async () => {
    if (!userEmail.trim() || !userTitle.trim() || !userBody.trim()) {
      toast.error('Укажите email, заголовок и текст')
      return
    }
    setSendingUser(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'user', email: userEmail.trim(), title: userTitle.trim(), body: userBody.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Ошибка')
      }
      toast.success('Уведомление отправлено')
      setUserEmail('')
      setUserTitle('')
      setUserBody('')
      loadHistory()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отправить')
    } finally {
      setSendingUser(false)
    }
  }

  return (
    <div className={styles.tab_content}>
      {/* Send to specific user */}
      <div className={styles.notif_form}>
        <p className={styles.notif_section_heading}>Отправить конкретному пользователю</p>
        <div className={styles.notif_field}>
          <label className={styles.notif_label}>Email пользователя</label>
          <input
            className={styles.notif_input}
            type="email"
            placeholder="user@example.com"
            value={userEmail}
            onChange={e => setUserEmail(e.target.value)}
            disabled={sendingUser}
          />
        </div>
        <div className={styles.notif_field}>
          <label className={styles.notif_label}>Заголовок</label>
          <input
            className={styles.notif_input}
            type="text"
            placeholder="Заголовок уведомления"
            value={userTitle}
            onChange={e => setUserTitle(e.target.value)}
            disabled={sendingUser}
          />
        </div>
        <div className={styles.notif_field}>
          <label className={styles.notif_label}>Текст</label>
          <textarea
            className={styles.notif_textarea}
            rows={2}
            placeholder="Текст уведомления..."
            value={userBody}
            onChange={e => setUserBody(e.target.value)}
            disabled={sendingUser}
          />
        </div>
        <div className={styles.notif_actions}>
          <button
            className={styles.send_btn}
            onClick={handleSendUser}
            disabled={sendingUser || !userEmail.trim() || !userTitle.trim() || !userBody.trim()}
          >
            {sendingUser ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>

      {/* Bulk send */}
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

      {/* Telegram */}
      <div className={styles.tg_block}>
        <div className={styles.tg_header}>
          <span className={styles.tg_icon}>✈️</span>
          <div>
            <p className={styles.notif_section_heading} style={{ marginBottom: 2 }}>Telegram-уведомления</p>
            {tgStats !== null ? (
              <p className={styles.tg_stats}>
                {tgStats.total === 0
                  ? 'Нет пользователей с привязанным Telegram'
                  : `${tgStats.total} польз. привязали Telegram (учеников: ${tgStats.students}, репетиторов: ${tgStats.teachers})`}
              </p>
            ) : (
              <p className={styles.tg_stats}>Загрузка…</p>
            )}
          </div>
        </div>

        {/* Broadcast */}
        <div className={styles.tg_section}>
          <label className={styles.notif_label}>Рассылка произвольного сообщения</label>
          <textarea
            className={styles.notif_textarea}
            rows={3}
            placeholder="Текст сообщения в Telegram (поддерживается Markdown)…"
            value={tgMessage}
            onChange={e => setTgMessage(e.target.value)}
            disabled={tgSending}
          />
          <div className={styles.tg_actions}>
            <button
              className={styles.tg_btn_send}
              onClick={handleTgBroadcast}
              disabled={tgSending || !tgMessage.trim() || !tgStats?.total}
            >
              {tgSending ? 'Отправка…' : `Отправить всем (${tgStats?.total ?? 0})`}
            </button>
            {tgResult && (
              <span className={styles.tg_result}>
                ✓ {tgResult.sent} доставлено{tgResult.failed > 0 ? `, ${tgResult.failed} не удалось` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Trigger reminders */}
        <div className={styles.tg_section}>
          <label className={styles.notif_label}>Запустить напоминания о предстоящих уроках прямо сейчас</label>
          <p className={styles.tg_hint}>Отправит напоминания о всех уроках, запланированных в ближайшие 48 часов. Логика та же, что у ежедневного бота.</p>
          <div className={styles.tg_actions}>
            <button
              className={styles.tg_btn_trigger}
              onClick={handleTgTrigger}
              disabled={tgTriggering}
            >
              {tgTriggering ? '⏳ Отправляю…' : '▶ Запустить напоминания'}
            </button>
            {tgTriggerResult && (
              <span className={styles.tg_result}>
                ✓ Уроков найдено: {tgTriggerResult.conferences}, сообщений отправлено: {tgTriggerResult.sent}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className={styles.notif_history}>
        <p className={styles.notif_section_heading}>Последние отправленные уведомления</p>
        {historyLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeleton} style={{ height: 56 }} />)
        ) : history.length === 0 ? (
          <div className={styles.empty}><p>Нет уведомлений</p></div>
        ) : (
          <div className={styles.notif_history_list}>
            {history.map(n => {
              const recipient = n.teacher?.name ?? n.student?.name ?? 'Все'
              return (
                <div key={n.id} className={styles.notif_history_item}>
                  <div className={styles.notif_history_left}>
                    <span className={styles.notif_history_title}>{n.title}</span>
                    <span className={styles.notif_history_body}>{n.body.length > 80 ? n.body.slice(0, 80) + '…' : n.body}</span>
                    <span className={styles.notif_history_meta}>{recipient} · {fmt(n.createdAt)}</span>
                  </div>
                  <span className={`${styles.notif_read_dot} ${n.isRead ? styles.notif_read : styles.notif_unread}`} title={n.isRead ? 'Прочитано' : 'Не прочитано'} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Promo codes tab ──────────────────────────────────────

interface PromoCodeItem {
  id: string
  code: string
  rewardType: 'FREE_VIP' | 'DISCOUNT'
  discountPercent: number | null
  vipDays: number
  description: string
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

interface ServicePromoCodeItem {
  id: string
  code: string
  discount: number
  usageLimit: number | null
  usedCount: number
  createdAt: string
  service: { id: string; title: string }
}

interface VipUsageItem {
  id: string
  createdAt: string
  userRole: string
  description: string
  teacher: { name: string; email: string } | null
  student: { name: string; email: string } | null
}

function PromoCodesTab() {
  const [codes, setCodes] = useState<PromoCodeItem[]>([])
  const [serviceCodes, setServiceCodes] = useState<ServicePromoCodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [usagesOpen, setUsagesOpen] = useState<string | null>(null)
  const [usagesData, setUsagesData] = useState<Record<string, VipUsageItem[]>>({})
  const [usagesLoading, setUsagesLoading] = useState<string | null>(null)

  const [form, setForm] = useState({
    rewardType: 'FREE_VIP' as 'FREE_VIP' | 'DISCOUNT',
    code: '',
    autoCode: true,
    description: '',
    discountPercent: '',
    vipDays: '30',
    maxUses: '',
    expiresAt: '',
  })

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/promo-codes')
    if (!res.ok) return
    const data = await res.json()
    setCodes(data.codes)
    setServiceCodes(data.serviceCodes)
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const handleCreate = async () => {
    if (!form.description.trim()) { toast.error('Укажите описание'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rewardType: form.rewardType,
          code: form.autoCode ? undefined : form.code,
          autoCode: form.autoCode,
          description: form.description,
          discountPercent: form.rewardType === 'DISCOUNT' ? form.discountPercent : undefined,
          vipDays: form.rewardType === 'FREE_VIP' ? form.vipDays : undefined,
          maxUses: form.maxUses || undefined,
          expiresAt: form.expiresAt || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      toast.success('Промокод создан')
      setShowForm(false)
      setForm({ rewardType: 'FREE_VIP', code: '', autoCode: true, description: '', discountPercent: '', vipDays: '30', maxUses: '', expiresAt: '' })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка при создании')
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (item: PromoCodeItem) => {
    try {
      const res = await fetch(`/api/admin/promo-codes/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      if (!res.ok) throw new Error()
      setCodes(prev => prev.map(c => c.id === item.id ? { ...c, isActive: !item.isActive } : c))
      toast.success(item.isActive ? 'Промокод деактивирован' : 'Промокод активирован')
    } catch {
      toast.error('Не удалось обновить статус')
    }
  }

  const handleDelete = async (item: PromoCodeItem) => {
    if (!confirm(`Удалить промокод "${item.code}"? Это действие нельзя отменить.`)) return
    try {
      const res = await fetch(`/api/admin/promo-codes/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCodes(prev => prev.filter(c => c.id !== item.id))
      toast.success('Промокод удалён')
    } catch {
      toast.error('Не удалось удалить промокод')
    }
  }

  const handleCopy = (item: PromoCodeItem) => {
    navigator.clipboard.writeText(item.code).then(() => {
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(p => (p === item.id ? null : p)), 1800)
    })
  }

  const handleToggleUsages = async (item: PromoCodeItem) => {
    if (usagesOpen === item.id) {
      setUsagesOpen(null)
      return
    }
    setUsagesOpen(item.id)
    if (usagesData[item.id]) return
    setUsagesLoading(item.id)
    try {
      const res = await fetch(`/api/admin/promo-codes/${item.id}/usages`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsagesData(prev => ({ ...prev, [item.id]: data.transactions }))
    } catch {
      toast.error('Не удалось загрузить использования')
    } finally {
      setUsagesLoading(null)
    }
  }

  return (
    <div className={styles.tab_content}>
      <div className={styles.promo_header}>
        <h3 className={styles.promo_section_title}>Платформенные промокоды</h3>
        <button className={styles.create_promo_btn} onClick={() => setShowForm(p => !p)}>
          {showForm ? 'Отмена' : '+ Создать промокод'}
        </button>
      </div>

      {showForm && (
        <div className={styles.promo_form}>
          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>Тип</label>
            <div className={styles.status_row}>
              {(['FREE_VIP', 'DISCOUNT'] as const).map(t => (
                <button
                  key={t}
                  className={`${styles.status_chip} ${form.rewardType === t ? styles.status_chip_active : ''}`}
                  style={form.rewardType === t ? { background: '#eef2ff', color: '#6366f1', borderColor: '#6366f144' } : {}}
                  onClick={() => setForm(p => ({ ...p, rewardType: t }))}
                >
                  {t === 'FREE_VIP' ? 'VIP (бесплатно)' : 'Скидка'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>Код</label>
            <div className={styles.promo_code_row}>
              <label className={styles.promo_checkbox_label}>
                <input
                  type="checkbox"
                  checked={form.autoCode}
                  onChange={e => setForm(p => ({ ...p, autoCode: e.target.checked }))}
                />
                Автогенерация
              </label>
              {!form.autoCode && (
                <input
                  className={styles.notif_input}
                  placeholder="MYCODE123"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  style={{ flex: 1 }}
                />
              )}
            </div>
          </div>

          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>Описание</label>
            <input className={styles.notif_input} placeholder="Описание промокода" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          {form.rewardType === 'FREE_VIP' && (
            <div className={styles.promo_form_row}>
              <label className={styles.notif_label}>Дней VIP</label>
              <input className={styles.notif_input} type="number" min="1" placeholder="30" value={form.vipDays} onChange={e => setForm(p => ({ ...p, vipDays: e.target.value }))} />
            </div>
          )}

          {form.rewardType === 'DISCOUNT' && (
            <div className={styles.promo_form_row}>
              <label className={styles.notif_label}>Скидка (%)</label>
              <input className={styles.notif_input} type="number" min="1" max="100" placeholder="10" value={form.discountPercent} onChange={e => setForm(p => ({ ...p, discountPercent: e.target.value }))} />
            </div>
          )}

          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>Макс. использований <span className={styles.notif_optional}>(пусто = без лимита)</span></label>
            <input className={styles.notif_input} type="number" min="1" placeholder="100" value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))} />
          </div>

          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>Действует до <span className={styles.notif_optional}>(необязательно)</span></label>
            <input className={styles.notif_input} type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
          </div>

          <div className={styles.notif_actions}>
            <button className={styles.send_btn} onClick={handleCreate} disabled={creating}>
              {creating ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeleton} />)
      ) : codes.length === 0 ? (
        <div className={styles.empty}><p>Промокодов нет</p></div>
      ) : (
        <div className={styles.promo_list}>
          {codes.map(item => (
            <div key={item.id} className={`${styles.promo_card} ${!item.isActive ? styles.promo_card_inactive : ''}`}>
              <div className={styles.promo_card_top}>
                <span className={styles.promo_code_badge}>{item.code}</span>
                <span className={`${styles.promo_type_badge} ${item.rewardType === 'FREE_VIP' ? styles.promo_vip : styles.promo_discount}`}>
                  {item.rewardType === 'FREE_VIP' ? `VIP ${item.vipDays}д` : `−${item.discountPercent}%`}
                </span>
                <span className={styles.promo_uses}>{item.usedCount}{item.maxUses ? `/${item.maxUses}` : ''} использ.</span>
                <div style={{ flex: 1 }} />
                {/* Copy button */}
                <button
                  className={styles.promo_icon_btn}
                  onClick={() => handleCopy(item)}
                  title="Скопировать код"
                >
                  {copiedId === item.id ? (
                    <span className={styles.promo_copied_text}>Скопировано!</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
                <button
                  className={`${styles.promo_toggle_btn} ${item.isActive ? styles.promo_toggle_active : ''}`}
                  onClick={() => toggleActive(item)}
                >
                  {item.isActive ? 'Активен' : 'Неактивен'}
                </button>
                {/* Delete button */}
                <button
                  className={styles.promo_delete_btn}
                  onClick={() => handleDelete(item)}
                  title="Удалить промокод"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
              <p className={styles.promo_desc}>{item.description}</p>
              {item.expiresAt && (
                <span className={styles.promo_expires}>до {new Date(item.expiresAt).toLocaleDateString('ru')}</span>
              )}
              {/* Usages toggle */}
              <div className={styles.promo_usages_row}>
                <button
                  className={styles.promo_usages_btn}
                  onClick={() => handleToggleUsages(item)}
                >
                  {usagesOpen === item.id ? 'Скрыть использования' : 'Использования'}
                </button>
              </div>
              {usagesOpen === item.id && (
                <div className={styles.promo_usages_panel}>
                  {usagesLoading === item.id ? (
                    <div className={styles.spinner_wrap}><div className={styles.spinner} /></div>
                  ) : !usagesData[item.id] || usagesData[item.id].length === 0 ? (
                    <p className={styles.promo_usages_empty}>Нет использований</p>
                  ) : (
                    <table className={styles.promo_usages_table}>
                      <thead>
                        <tr>
                          <th>Имя</th>
                          <th>Email</th>
                          <th>Роль</th>
                          <th>Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usagesData[item.id].map(tx => {
                          const user = tx.teacher ?? tx.student
                          return (
                            <tr key={tx.id}>
                              <td>{user?.name ?? '—'}</td>
                              <td>{user?.email ?? '—'}</td>
                              <td>{tx.userRole === 'TEACHER' ? 'Учитель' : 'Ученик'}</td>
                              <td>{fmt(tx.createdAt)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {serviceCodes.length > 0 && (
        <>
          <div className={styles.divider} style={{ margin: '8px 0' }} />
          <h3 className={styles.promo_section_title}>Сервисные промокоды учителей</h3>
          <div className={styles.promo_list}>
            {serviceCodes.map(item => (
              <div key={item.id} className={styles.promo_card}>
                <div className={styles.promo_card_top}>
                  <span className={styles.promo_code_badge}>{item.code}</span>
                  <span className={`${styles.promo_type_badge} ${styles.promo_discount}`}>−{item.discount}%</span>
                  <span className={styles.promo_uses}>{item.usedCount}{item.usageLimit ? `/${item.usageLimit}` : ''} использ.</span>
                  <div style={{ flex: 1 }} />
                </div>
                <p className={styles.promo_desc}>
                  Сервис: <a href={`/service/${item.service.id}`} className={styles.target_link} target="_blank">{item.service.title}</a>
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Verifications tab ────────────────────────────────────

interface ExperienceVerifItem {
  id: string
  title: string
  organization: string | null
  yearFrom: number
  yearTo: number | null
  documentUrls: string[]
  verifiedAt: string | null
  teacher: { id: string; name: string; email: string }
}

interface IdentityVerifItem {
  id: string
  name: string
  email: string
  passportDocumentUrl: string
  pasportConfirmed: boolean | null
}

function VerificationsTab() {
  const [experiences, setExperiences] = useState<ExperienceVerifItem[]>([])
  const [identities, setIdentities] = useState<IdentityVerifItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/verifications')
    if (!res.ok) return
    const d = await res.json()
    setExperiences(d.experiences ?? [])
    setIdentities(d.identities ?? [])
  }, [])

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)) }, [load])

  const verifyExp = async (id: string, verify: boolean) => {
    const res = await fetch(`/api/admin/verifications/experience/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Ошибка'); return }
    const d = await res.json()
    setExperiences(p => p.map(e => e.id === id ? { ...e, verifiedAt: d.experience.verifiedAt } : e))
    toast.success(verify ? 'Подтверждено' : 'Подтверждение снято')
  }

  const verifyIdentity = async (teacherId: string, verify: boolean) => {
    const res = await fetch(`/api/admin/verifications/identity/${teacherId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify }),
    })
    if (!res.ok) { toast.error('Ошибка'); return }
    setIdentities(p => p.map(i => i.id === teacherId ? { ...i, pasportConfirmed: verify } : i))
    toast.success(verify ? 'Личность подтверждена' : 'Подтверждение снято')
  }

  return (
    <div className={styles.tab_content}>
      <h3 className={styles.promo_section_title}>Опыт работы репетиторов</h3>
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeleton} />)
      ) : experiences.length === 0 ? (
        <div className={styles.empty}><p>Нет записей об опыте</p></div>
      ) : (
        <div className={styles.verif_list}>
          {experiences.map(exp => (
            <div key={exp.id} className={styles.verif_card}>
              <div className={styles.verif_card_top}>
                <div className={styles.verif_info}>
                  <span className={styles.verif_name}>{exp.teacher.name}</span>
                  <span className={styles.verif_sub}>{exp.title}{exp.organization ? ` · ${exp.organization}` : ''} · {exp.yearFrom}–{exp.yearTo ?? 'н.в.'}</span>
                </div>
                <div className={styles.verif_actions}>
                  {exp.verifiedAt && (
                    <span className={styles.verif_check} title={`Подтверждено ${new Date(exp.verifiedAt).toLocaleDateString('ru')}`}>✓</span>
                  )}
                  <span className={styles.verif_docs_count} title={exp.documentUrls.length === 0 ? 'Нет документов' : `${exp.documentUrls.length} документ(ов)`}>
                    {exp.documentUrls.length === 0 ? '📎 нет' : `📎 ${exp.documentUrls.length}`}
                  </span>
                  {exp.documentUrls.length > 0 && (
                    <div className={styles.verif_doc_previews}>
                      {exp.documentUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className={styles.verif_doc_link}>
                          <img src={url} alt={`doc ${i+1}`} className={styles.verif_doc_thumb} />
                        </a>
                      ))}
                    </div>
                  )}
                  <button
                    className={`${styles.verif_btn} ${exp.verifiedAt ? styles.verif_btn_active : ''}`}
                    onClick={() => verifyExp(exp.id, !exp.verifiedAt)}
                    disabled={!exp.verifiedAt && exp.documentUrls.length === 0}
                    title={!exp.verifiedAt && exp.documentUrls.length === 0 ? 'Нет документов для подтверждения' : ''}
                  >
                    {exp.verifiedAt ? 'Снять ✓' : 'Подтвердить'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.divider} style={{ margin: '12px 0' }} />
      <h3 className={styles.promo_section_title}>Подтверждение личности</h3>
      {loading ? null : identities.length === 0 ? (
        <div className={styles.empty}><p>Нет загруженных паспортов</p></div>
      ) : (
        <div className={styles.verif_list}>
          {identities.map(item => (
            <div key={item.id} className={styles.verif_card}>
              <div className={styles.verif_card_top}>
                <div className={styles.verif_info}>
                  <span className={styles.verif_name}>{item.name}</span>
                  <span className={styles.verif_sub}>{item.email}</span>
                </div>
                <div className={styles.verif_actions}>
                  {item.pasportConfirmed && (
                    <span className={styles.verif_check} title="Личность подтверждена">✓</span>
                  )}
                  <a href={item.passportDocumentUrl} target="_blank" rel="noreferrer" className={styles.verif_doc_link}>
                    <img src={item.passportDocumentUrl} alt="passport" className={styles.verif_doc_thumb} />
                  </a>
                  <button
                    className={`${styles.verif_btn} ${item.pasportConfirmed ? styles.verif_btn_active : ''}`}
                    onClick={() => verifyIdentity(item.id, !item.pasportConfirmed)}
                  >
                    {item.pasportConfirmed ? 'Снять ✓' : 'Подтвердить'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Content moderation tab ───────────────────────────────

type ContentType = 'posts' | 'roadmaps'
type ModerationStatus = 'PUBLISHED' | 'PENDING' | 'BLOCKED'

const MODERATION_CFG: Record<ModerationStatus, { label: string; color: string; bg: string }> = {
  PUBLISHED: { label: 'Опубликовано', color: '#15803D', bg: '#F0FDF4' },
  PENDING:   { label: 'На модерации', color: '#B45309', bg: '#FFFBEB' },
  BLOCKED:   { label: 'Заблокировано', color: '#A32D2D', bg: '#FCEBEB' },
}

const CONTENT_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all',       label: 'Все' },
  { value: 'PUBLISHED', label: 'Опубликовано' },
  { value: 'PENDING',   label: 'На модерации' },
  { value: 'BLOCKED',   label: 'Заблокировано' },
]

interface ContentItem {
  id: string
  title: string
  moderationStatus: ModerationStatus
  createdAt: string
  viewCount?: number
  price?: number
  teacher: { id: string; name: string }
  _count: { comments: number; ratings: number; progress?: number }
}

function ContentTab() {
  const [contentType, setContentType] = useState<ContentType>('posts')
  const [statusFilter, setStatusFilter] = useState('all')
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchPage = useCallback(async (p: number, type: ContentType, status: string, replace = false) => {
    const params = new URLSearchParams({ type, status, page: String(p) })
    const res = await fetch(`/api/admin/content?${params}`)
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
    fetchPage(1, contentType, statusFilter, true).finally(() => setLoading(false))
  }, [contentType, statusFilter, fetchPage])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    await fetchPage(page + 1, contentType, statusFilter)
    setLoadingMore(false)
  }

  const handleStatusChange = async (item: ContentItem, newStatus: ModerationStatus) => {
    setUpdating(item.id)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, type: contentType, moderationStatus: newStatus }),
      })
      if (!res.ok) throw new Error()
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, moderationStatus: newStatus } : i))
      toast.success('Статус обновлён')
    } catch {
      toast.error('Не удалось обновить статус')
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (item: ContentItem) => {
    if (!confirm(`Удалить "${item.title}"? Это действие нельзя отменить.`)) return
    setDeleting(item.id)
    try {
      const params = new URLSearchParams({ id: item.id, type: contentType })
      const res = await fetch(`/api/admin/content?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems(prev => prev.filter(i => i.id !== item.id))
      setTotal(prev => prev - 1)
      toast.success('Удалено')
    } catch {
      toast.error('Не удалось удалить')
    } finally {
      setDeleting(null)
    }
  }

  const statusActions = (['PUBLISHED', 'PENDING', 'BLOCKED'] as ModerationStatus[]).map(s => ({
    status: s,
    label: MODERATION_CFG[s].label,
    color: MODERATION_CFG[s].color,
    bg: MODERATION_CFG[s].bg,
  }))

  return (
    <div className={styles.tab_content}>
      <div className={styles.tab_header}>
        <div className={styles.content_sub_tabs}>
          <button
            className={`${styles.content_sub_tab} ${contentType === 'posts' ? styles.content_sub_tab_active : ''}`}
            onClick={() => setContentType('posts')}
          >
            Посты
          </button>
          <button
            className={`${styles.content_sub_tab} ${contentType === 'roadmaps' ? styles.content_sub_tab_active : ''}`}
            onClick={() => setContentType('roadmaps')}
          >
            Road-maps
          </button>
        </div>
      </div>

      <div className={styles.filter_tabs}>
        {CONTENT_STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`${styles.filter_tab} ${statusFilter === f.value ? styles.filter_tab_active : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        {total > 0 && <span className={styles.total_badge}>{total}</span>}
      </div>

      <div className={styles.list}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p>Нет контента</p>
          </div>
        ) : (
          items.map(item => {
            const cfg = MODERATION_CFG[item.moderationStatus] ?? MODERATION_CFG.PUBLISHED
            const href = contentType === 'posts' ? `/post/${item.id}` : `/road-map/${item.id}`
            return (
              <div key={item.id} className={styles.content_card}>
                <div className={styles.content_card_left}>
                  <Link href={href} className={styles.content_card_title} target="_blank" rel="noreferrer">
                    {item.title || '(без названия)'}
                  </Link>
                  <div className={styles.content_card_meta}>
                    <span>{item.teacher.name}</span>
                    <span>·</span>
                    <span>{fmt(item.createdAt)}</span>
                    {contentType === 'posts' && item.viewCount !== undefined && (
                      <>
                        <span>·</span>
                        <span>{item.viewCount} просм.</span>
                      </>
                    )}
                    {contentType === 'roadmaps' && item._count.progress !== undefined && (
                      <>
                        <span>·</span>
                        <span>{item._count.progress} уч.</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{item._count.comments} комм.</span>
                  </div>
                </div>
                <div className={styles.content_card_right}>
                  <span
                    className={styles.status_badge}
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                  {statusActions
                    .filter(a => a.status !== item.moderationStatus)
                    .map(a => (
                      <button
                        key={a.status}
                        className={styles.content_action_btn}
                        style={{ borderColor: a.color + '44', color: a.color, background: a.bg }}
                        onClick={() => handleStatusChange(item, a.status)}
                        disabled={updating === item.id}
                      >
                        {a.label}
                      </button>
                    ))
                  }
                  <button
                    className={styles.content_delete_btn}
                    onClick={() => handleDelete(item)}
                    disabled={deleting === item.id}
                  >
                    {deleting === item.id ? '…' : 'Удалить'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {hasMore && (
        <button className={styles.load_more_btn} onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Загрузка…' : 'Загрузить ещё'}
        </button>
      )}
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────

function daysSince(iso: string | null): string {
  if (!iso) return 'Никогда'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Сегодня'
  return `${diff} д. назад`
}

function UserCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: UserItem
  onUpdate: (id: string, role: string, patch: Partial<UserItem>) => void
  onDelete: (id: string, role: string) => void
}) {
  const [banOpen, setBanOpen] = useState(false)
  const [banReasonInput, setBanReasonInput] = useState('')
  const [processing, setProcessing] = useState(false)

  const initial = item.name.trim().charAt(0).toUpperCase() || '?'
  const isTeacher = item.role === 'TEACHER'

  const patch = async (fields: Record<string, unknown>) => {
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, role: item.role, ...fields }),
      })
      if (!res.ok) throw new Error()
      onUpdate(item.id, item.role, fields as Partial<UserItem>)
      toast.success('Обновлено')
    } catch {
      toast.error('Не удалось обновить')
    } finally {
      setProcessing(false)
    }
  }

  const handleBan = async () => {
    await patch({ isBanned: true, banReason: banReasonInput.trim() || null })
    setBanOpen(false)
    setBanReasonInput('')
  }

  const handleUnban = async () => {
    await patch({ isBanned: false })
  }

  const handleVipToggle = async () => {
    if (item.isVip) {
      await patch({ isVip: false })
    } else {
      const until = new Date(Date.now() + 30 * 86400000).toISOString()
      await patch({ isVip: true, vipExpiresAt: until })
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить пользователя "${item.name}"? Это действие нельзя отменить.`)) return
    setProcessing(true)
    try {
      const params = new URLSearchParams({ id: item.id, role: item.role })
      const res = await fetch(`/api/admin/users?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDelete(item.id, item.role)
      toast.success('Пользователь удалён')
    } catch {
      toast.error('Не удалось удалить')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className={styles.user_card}>
      {/* Avatar */}
      <div
        className={styles.user_avatar}
        style={{ background: isTeacher ? '#eef2ff' : '#f0fdfa', color: isTeacher ? '#6366f1' : '#0d9488' }}
      >
        {initial}
      </div>

      {/* Info */}
      <div className={styles.user_info}>
        <div className={styles.user_name}>{item.name}</div>
        <div className={styles.user_email}>{item.email}</div>

        <div className={styles.user_badges}>
          <span
            className={styles.user_badge}
            style={isTeacher
              ? { background: '#eef2ff', color: '#6366f1' }
              : { background: '#f0fdfa', color: '#0d9488' }}
          >
            {isTeacher ? 'Учитель' : 'Ученик'}
          </span>
          {item.isVip && (
            <span className={styles.user_badge} style={{ background: '#fef9ee', color: '#d97706' }}>
              VIP
            </span>
          )}
          {item.isBanned && (
            <span className={styles.user_badge} style={{ background: '#fef2f2', color: '#dc2626' }}>
              БАН
            </span>
          )}
        </div>

        <div className={styles.user_stats}>
          Последний визит: {daysSince(item.lastSeenAt)}
          {' · '}
          Рег.: {fmt(item.createdAt)}
          {isTeacher && (
            <>
              {' · '}
              {item._count.posts ?? 0} постов · {item._count.roadmaps ?? 0} роадмапов · {item._count.students ?? 0} уч.
            </>
          )}
          {!isTeacher && (
            <>
              {' · '}
              {item._count.teachers ?? 0} учителей
            </>
          )}
        </div>

        {item.isBanned && item.banReason && (
          <div className={styles.user_stats} style={{ color: '#dc2626' }}>
            Причина бана: {item.banReason}
          </div>
        )}

        {/* Inline ban form */}
        {banOpen && (
          <div className={styles.ban_form}>
            <textarea
              className={styles.ban_textarea}
              rows={2}
              placeholder="Причина бана (необязательно)…"
              value={banReasonInput}
              onChange={e => setBanReasonInput(e.target.value)}
              disabled={processing}
            />
            <div className={styles.ban_btn_row}>
              <button
                className={styles.ban_confirm_btn}
                onClick={handleBan}
                disabled={processing}
              >
                {processing ? 'Обработка…' : 'Подтвердить бан'}
              </button>
              <button
                className={styles.filter_tab}
                onClick={() => { setBanOpen(false); setBanReasonInput('') }}
                disabled={processing}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.user_actions}>
        <div className={styles.user_action_row}>
          {!item.isBanned ? (
            <button
              className={styles.ban_confirm_btn}
              onClick={() => setBanOpen(p => !p)}
              disabled={processing}
            >
              Забанить
            </button>
          ) : (
            <button
              className={styles.unban_btn}
              onClick={handleUnban}
              disabled={processing}
            >
              Разбанить
            </button>
          )}
          <button
            className={styles.vip_btn}
            onClick={handleVipToggle}
            disabled={processing}
          >
            {item.isVip ? 'Снять VIP' : 'VIP 30д'}
          </button>
        </div>
        <div className={styles.user_action_row} style={{ justifyContent: 'flex-end' }}>
          <button
            className={styles.delete_user_btn}
            onClick={handleDelete}
            disabled={processing}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'TEACHER' | 'STUDENT'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned' | 'vip'>('all')
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(async (
    p: number,
    q: string,
    role: string,
    status: string,
    replace = false,
  ) => {
    const params = new URLSearchParams({ page: String(p), limit: '20' })
    if (role !== 'all') params.set('role', role)
    if (status !== 'all') params.set('status', status)
    if (q) params.set('q', q)
    const res = await fetch(`/api/admin/users?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setItems(prev => replace ? data.items : [...prev, ...data.items])
    setTotal(data.total ?? 0)
    setHasMore(p < data.totalPages)
    setPage(p)
  }, [])

  // debounced search + filter reload
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      setItems([])
      fetchPage(1, search, roleFilter, statusFilter, true).finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(t)
  }, [search, roleFilter, statusFilter, fetchPage])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    await fetchPage(page + 1, search, roleFilter, statusFilter)
    setLoadingMore(false)
  }

  const handleUpdate = useCallback((id: string, role: string, patch: Partial<UserItem>) => {
    setItems(prev => prev.map(u =>
      u.id === id && u.role === role ? { ...u, ...patch } : u
    ))
  }, [])

  const handleDelete = useCallback((id: string, role: string) => {
    setItems(prev => prev.filter(u => !(u.id === id && u.role === role)))
    setTotal(prev => prev - 1)
  }, [])

  const ROLE_OPTS: { value: 'all' | 'TEACHER' | 'STUDENT'; label: string }[] = [
    { value: 'all',     label: 'Все' },
    { value: 'TEACHER', label: 'Учителя' },
    { value: 'STUDENT', label: 'Ученики' },
  ]

  const STATUS_OPTS: { value: 'all' | 'active' | 'banned' | 'vip'; label: string }[] = [
    { value: 'all',    label: 'Все' },
    { value: 'active', label: 'Активные' },
    { value: 'banned', label: 'Забаненые' },
    { value: 'vip',    label: 'VIP' },
  ]

  return (
    <div className={styles.tab_content}>
      {/* Search + filters */}
      <div className={styles.users_search_row}>
        <input
          className={styles.users_search_input}
          type="text"
          placeholder="Поиск по имени или email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filter_tabs}>
          {ROLE_OPTS.map(o => (
            <button
              key={o.value}
              className={`${styles.filter_tab} ${roleFilter === o.value ? styles.filter_tab_active : ''}`}
              onClick={() => setRoleFilter(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className={styles.filter_tabs}>
          {STATUS_OPTS.map(o => (
            <button
              key={o.value}
              className={`${styles.filter_tab} ${statusFilter === o.value ? styles.filter_tab_active : ''}`}
              onClick={() => setStatusFilter(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {total > 0 && <span className={styles.total_badge}>{total}</span>}
      </div>

      {/* List */}
      <div className={styles.list}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <p>Пользователей не найдено</p>
          </div>
        ) : (
          items.map(item => (
            <UserCard
              key={`${item.role}-${item.id}`}
              item={item}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {hasMore && (
        <button className={styles.load_more_btn} onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Загрузка…' : 'Загрузить ещё'}
        </button>
      )}
    </div>
  )
}

// ─── Stats tab ────────────────────────────────────────────

interface StatsData {
  users: {
    totalStudents: number; totalTeachers: number
    newStudentsWeek: number; newTeachersWeek: number
    newStudentsMonth: number; newTeachersMonth: number
    vipStudents: number; vipTeachers: number
    bannedStudents: number; bannedTeachers: number
  }
  content: {
    totalPosts: number; totalRoadmaps: number
    publishedPosts: number; pendingPosts: number; blockedPosts: number
    publishedRoadmaps: number; pendingRoadmaps: number; blockedRoadmaps: number
  }
  complaints: { pending: number; total: number }
  promos: { total: number; active: number }
  recentTransactions: {
    id: string; createdAt: string; userRole: string; description: string
    teacher: { name: string } | null
    student: { name: string } | null
    promoCode: { code: string } | null
  }[]
}

function StatCard({ title, value, sub, subColor }: { title: string; value: number | string; sub?: string; subColor?: string }) {
  return (
    <div className={styles.stat_card}>
      <span className={styles.stat_label}>{title}</span>
      <span className={styles.stat_num}>{value}</span>
      {sub && <span className={styles.stat_sub} style={subColor ? { color: subColor } : {}}>{sub}</span>}
    </div>
  )
}

function StatsTab() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className={styles.tab_content}>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
      </div>
    )
  }

  if (!data) {
    return (
      <div className={styles.tab_content}>
        <div className={styles.empty}><p>Не удалось загрузить статистику</p></div>
      </div>
    )
  }

  const { users, content, complaints, promos, recentTransactions } = data

  return (
    <div className={styles.tab_content}>
      {/* Users section */}
      <div className={styles.stats_section}>
        <p className={styles.stats_section_title}>Пользователи</p>
        <div className={styles.stats_grid}>
          <StatCard title="Ученики" value={users.totalStudents} sub={`+${users.newStudentsWeek} за неделю`} subColor="#16a34a" />
          <StatCard title="Учителя" value={users.totalTeachers} sub={`+${users.newTeachersWeek} за неделю`} subColor="#16a34a" />
          <StatCard title="VIP всего" value={users.vipStudents + users.vipTeachers} sub={`уч. ${users.vipStudents} · учит. ${users.vipTeachers}`} />
          <StatCard title="Новых за месяц" value={users.newStudentsMonth + users.newTeachersMonth} sub={`уч. ${users.newStudentsMonth} · учит. ${users.newTeachersMonth}`} subColor="#6366f1" />
          <StatCard title="Заблокированных" value={users.bannedStudents + users.bannedTeachers} sub={`уч. ${users.bannedStudents} · учит. ${users.bannedTeachers}`} subColor={users.bannedStudents + users.bannedTeachers > 0 ? '#dc2626' : undefined} />
        </div>
      </div>

      {/* Content section */}
      <div className={styles.stats_section}>
        <p className={styles.stats_section_title}>Контент</p>
        <div className={styles.stats_content_row}>
          <div className={styles.stats_content_block}>
            <span className={styles.stats_content_label}>Посты</span>
            <div className={styles.stats_content_pills}>
              <span className={styles.stats_pill} style={{ background: '#F0FDF4', color: '#15803D' }}>опубл. {content.publishedPosts}</span>
              <span className={styles.stats_pill} style={{ background: '#FFFBEB', color: '#B45309' }}>модерация {content.pendingPosts}</span>
              <span className={styles.stats_pill} style={{ background: '#FCEBEB', color: '#A32D2D' }}>заблок. {content.blockedPosts}</span>
            </div>
          </div>
          <div className={styles.stats_content_block}>
            <span className={styles.stats_content_label}>Road-maps</span>
            <div className={styles.stats_content_pills}>
              <span className={styles.stats_pill} style={{ background: '#F0FDF4', color: '#15803D' }}>опубл. {content.publishedRoadmaps}</span>
              <span className={styles.stats_pill} style={{ background: '#FFFBEB', color: '#B45309' }}>модерация {content.pendingRoadmaps}</span>
              <span className={styles.stats_pill} style={{ background: '#FCEBEB', color: '#A32D2D' }}>заблок. {content.blockedRoadmaps}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className={styles.stats_grid}>
        <StatCard title="Жалоб ожидает" value={complaints.pending} sub={`из ${complaints.total} всего`} subColor={complaints.pending > 0 ? '#f59e0b' : undefined} />
        <StatCard title="Промокодов активных" value={promos.active} sub={`из ${promos.total} всего`} />
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <div className={styles.stats_section}>
          <p className={styles.stats_section_title}>Последние VIP-транзакции</p>
          <div className={styles.stats_tx_list}>
            {recentTransactions.map(tx => {
              const user = tx.teacher ?? tx.student
              return (
                <div key={tx.id} className={styles.stats_tx_item}>
                  <span className={styles.stats_tx_name}>{user?.name ?? '—'}</span>
                  <span className={styles.stats_tx_role}>{tx.userRole === 'TEACHER' ? 'Учитель' : 'Ученик'}</span>
                  {tx.promoCode && <span className={styles.stats_tx_promo}>{tx.promoCode.code}</span>}
                  <span className={styles.stats_tx_desc}>{tx.description}</span>
                  <span className={styles.stats_tx_date}>{fmt(tx.createdAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Admin emails tab ─────────────────────────────────────

interface AdminEmailItem {
  id: string
  email: string
  createdAt: string
}

function AdminEmailsTab() {
  const { data: session } = useSession()
  const currentEmail = session?.user?.email ?? ''
  const [emails, setEmails] = useState<AdminEmailItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/admin-emails')
      if (!res.ok) return
      const data = await res.json()
      setEmails(data.emails ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newEmail.trim()) { toast.error('Введите email'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/admin/admin-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Ошибка')
      }
      toast.success('Администратор добавлен')
      setNewEmail('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось добавить')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (item: AdminEmailItem) => {
    if (!confirm(`Удалить администратора "${item.email}"?`)) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/admin/admin-emails?id=${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Ошибка')
      }
      toast.success('Удалено')
      setEmails(prev => prev.filter(e => e.id !== item.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={styles.tab_content}>
      <div className={styles.admin_emails_warning}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>Управление администраторами. Email в этом списке получают роль <strong>ADMIN</strong> при входе через аккаунт учителя.</span>
      </div>

      {/* Add new */}
      <div className={styles.admin_emails_add_row}>
        <input
          className={styles.notif_input}
          type="email"
          placeholder="new-admin@example.com"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          disabled={adding}
          style={{ flex: 1, maxWidth: 380 }}
        />
        <button className={styles.send_btn} style={{ height: 42 }} onClick={handleAdd} disabled={adding || !newEmail.trim()}>
          {adding ? 'Добавление…' : 'Добавить'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeleton} style={{ height: 52 }} />)
      ) : emails.length === 0 ? (
        <div className={styles.empty}><p>Нет администраторов</p></div>
      ) : (
        <div className={styles.admin_emails_list}>
          {emails.map(item => {
            const isMe = item.email.toLowerCase() === currentEmail.toLowerCase()
            return (
              <div key={item.id} className={styles.admin_email_row}>
                <div className={styles.admin_email_info}>
                  <span className={styles.admin_email_addr}>{item.email}</span>
                  {isMe && <span className={styles.admin_email_me}>Это вы</span>}
                  <span className={styles.admin_email_date}>{fmt(item.createdAt)}</span>
                </div>
                <button
                  className={styles.admin_email_delete_btn}
                  onClick={() => handleDelete(item)}
                  disabled={isMe || deletingId === item.id}
                  title={isMe ? 'Нельзя удалить себя' : 'Удалить администратора'}
                >
                  {deletingId === item.id ? '…' : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

type AdminTab = 'stats' | 'users' | 'content' | 'complaints' | 'promo' | 'notifications' | 'verifications' | 'admin-emails'

export function AdminPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<AdminTab>('stats')

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
          {/* Статистика — first */}
          <button
            className={`${styles.main_tab} ${activeTab === 'stats' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Статистика
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'users' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Пользователи
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'content' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Контент
          </button>
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
            className={`${styles.main_tab} ${activeTab === 'promo' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('promo')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
            Промокоды
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
          <button
            className={`${styles.main_tab} ${activeTab === 'verifications' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('verifications')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Верификации
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'admin-emails' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('admin-emails')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Администраторы
          </button>
        </div>

        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'content' && <ContentTab />}
        {activeTab === 'complaints' && <ComplaintsTab />}
        {activeTab === 'promo' && <PromoCodesTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'verifications' && <VerificationsTab />}
        {activeTab === 'admin-emails' && <AdminEmailsTab />}
      </div>
    </div>
  )
}
