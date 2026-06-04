'use client'

import { NavBar } from '@/widgets/BaseUI'
import { useTranslations } from 'next-intl'
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

const STATUS_CFG_COLORS: Record<string, { color: string; bg: string; tKey: string }> = {
  pending:  { color: '#f59e0b', bg: '#fffbeb', tKey: 'statusPending' },
  answered: { color: '#6366f1', bg: '#eef2ff', tKey: 'statusAnswered' },
  resolved: { color: '#22c55e', bg: '#f0fdf4', tKey: 'statusResolved' },
  closed:   { color: '#868897', bg: '#f7f7f7', tKey: 'statusClosed' },
}

const COMPLAINT_TABS = ['all', 'pending', 'answered', 'resolved', 'closed'] as const
type ComplaintTab = typeof COMPLAINT_TABS[number]
const COMPLAINT_TAB_TKEYS: Record<ComplaintTab, string> = {
  all: 'tabAll', pending: 'statusPending', answered: 'statusAnswered', resolved: 'statusResolved', closed: 'statusClosed',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short', year: 'numeric' })
}

function targetLabel(c: ComplaintItem, tPlatform: string, tFeedback: string, tPost: string, tRoadmap: string) {
  if (c.targetType === 'PLATFORM') return { label: tPlatform, href: null, kind: tFeedback }
  if (c.post) return { label: c.post.title || tPost, href: `/post/${c.post.id}`, kind: tPost }
  if (c.roadmap) return { label: c.roadmap.title || tRoadmap, href: `/road-map/${c.roadmap.id}`, kind: tRoadmap }
  return { label: c.targetType, href: null, kind: c.targetType }
}

// ─── Complaint card ───────────────────────────────────────

function ComplaintCard({ item, onReplied }: { item: ComplaintItem; onReplied: (id: string, reply: string) => void }) {
  const t = useTranslations('admin')
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [markingValuable, setMarkingValuable] = useState(false)
  const [statusValue, setStatusValue] = useState(item.status)
  const target = targetLabel(item, t('targetPlatform'), t('targetFeedback'), t('targetPost'), t('targetRoadmap'))
  const activeCfg = { ...(STATUS_CFG_COLORS[statusValue] ?? STATUS_CFG_COLORS.pending), label: t((STATUS_CFG_COLORS[statusValue]?.tKey ?? 'statusPending') as Parameters<typeof t>[0]) }

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
      toast.success(t('replySent'))
      onReplied(item.id, replyText.trim())
      setReplyText('')
    } catch {
      toast.error(t('replyError'))
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
      toast.success(t('statusUpdated'))
    } catch {
      toast.error(t('statusError'))
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
      toast.success(t('valuableSent'))
    } catch {
      toast.error(t('valuableError'))
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
          {item.reply && <span className={styles.has_reply_dot} title={t('hasReplyTooltip')} />}
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
            <p className={styles.section_label}>{t('sectionComplaint')}</p>
            <p className={styles.full_text}>{item.text}</p>
            <p className={styles.reporter_meta}>
              {t('fromLabel')}<span>{item.reporterRole === 'STUDENT' ? t('reporterStudent') : item.reporterRole === 'TEACHER' ? t('reporterTeacher') : t('reporterUser')}</span>
              {' · '}ID {item.reporterId.slice(0, 8)}…
            </p>
          </div>

          {item.reply && (
            <div className={styles.section}>
              <p className={styles.section_label}>{t('sectionReply')}</p>
              <div className={styles.reply_bubble}>
                <p>{item.reply}</p>
                {item.repliedAt && <span className={styles.reply_date}>{fmt(item.repliedAt)}</span>}
              </div>
            </div>
          )}

          {!item.reply && (
            <div className={styles.section}>
              <p className={styles.section_label}>{t('sectionWriteReply')}</p>
              <div className={styles.reply_input_row}>
                <textarea className={styles.reply_textarea} rows={3} {...{placeholder: t('replyPlaceholder')}} value={replyText} onChange={e => setReplyText(e.target.value)} disabled={sending} />
                <button className={styles.reply_btn} onClick={handleReply} disabled={sending || !replyText.trim()}>
                  {sending ? t('sendingBtn') : t('sendBtn')}
                </button>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <p className={styles.section_label}>{t('sectionStatus')}</p>
            <div className={styles.status_row}>
              {Object.entries(STATUS_CFG_COLORS).map(([key, s]) => (
                <button
                  key={key}
                  className={`${styles.status_chip} ${statusValue === key ? styles.status_chip_active : ''}`}
                  style={statusValue === key ? { color: s.color, background: s.bg, borderColor: s.color + '44' } : {}}
                  onClick={() => handleStatusChange(key)}
                >
                  {t(s.tKey as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>

          {item.targetType === 'PLATFORM' && (
            <div className={styles.section}>
              <p className={styles.section_label}>{t('sectionActions')}</p>
              <button
                className={styles.valuable_btn}
                onClick={handleMarkValuable}
                disabled={markingValuable}
              >
                {markingValuable ? t('valuableSending') : t('valuableBtn')}
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
  const t = useTranslations('admin')
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
          {COMPLAINT_TABS.map(tabKey => (
            <button key={tabKey} className={`${styles.filter_tab} ${tab === tabKey ? styles.filter_tab_active : ''}`} onClick={() => setTab(tabKey)}>
              {t(COMPLAINT_TAB_TKEYS[tabKey] as Parameters<typeof t>[0])}
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
            <p>{t('noComplaints')}</p>
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

const TARGET_OPTION_KEYS = [
  { value: 'all', tKey: 'audienceAll' },
  { value: 'students', tKey: 'audienceStudents' },
  { value: 'teachers', tKey: 'audienceTeachers' },
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
  const t = useTranslations('admin')
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
    const toastId = toast.loading(t('tgBroadcastToast'))
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'broadcast', message: tgMessage.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('tgBroadcastError'))
      setTgResult(data)
      toast.success(t('tgBroadcastSuccess', {sent: data.sent, total: data.total}), { id: toastId })
      setTgMessage('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('tgBroadcastError'), { id: toastId })
    } finally {
      setTgSending(false)
    }
  }

  const handleTgTrigger = async () => {
    setTgTriggering(true)
    setTgTriggerResult(null)
    const toastId = toast.loading(t('tgTriggerToast'))
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', hoursFrom: 0, hoursTo: 48 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('tgTriggerError'))
      setTgTriggerResult(data)
      toast.success(t('tgTriggerSuccess', {conferences: data.conferences, sent: data.sent}), { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('tgTriggerError'), { id: toastId })
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
      toast.error(t('notifBulkValidation'))
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
      toast.success(t('notifBulkSent', {count: data.created}))
      setTitle('')
      setBody('')
      setHtml('')
      loadHistory()
    } catch {
      toast.error(t('notifBulkError'))
    } finally {
      setSending(false)
    }
  }

  const handleSendUser = async () => {
    if (!userEmail.trim() || !userTitle.trim() || !userBody.trim()) {
      toast.error(t('notifValidation'))
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
      toast.success(t('notifUserSent'))
      setUserEmail('')
      setUserTitle('')
      setUserBody('')
      loadHistory()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('notifUserError'))
    } finally {
      setSendingUser(false)
    }
  }

  return (
    <div className={styles.tab_content}>
      {/* Send to specific user */}
      <div className={styles.notif_form}>
        <p className={styles.notif_section_heading}>{t('notifSendToUser')}</p>
        <div className={styles.notif_field}>
          <label className={styles.notif_label}>{t('notifEmailLabel')}</label>
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
            placeholder={t('notifTitlePlaceholder')}
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
            placeholder={t('notifBodyPlaceholder')}
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
            {sendingUser ? t('notifSending') : t('notifSendUserBtn')}
          </button>
        </div>
      </div>

      {/* Bulk send */}
      <div className={styles.notif_form}>
        <p className={styles.notif_desc}>
          {t('notifBulkDesc')}
        </p>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>{t('notifAudienceLabel')}</label>
          <div className={styles.target_row}>
            {TARGET_OPTION_KEYS.map(opt => (
              <button
                key={opt.value}
                className={`${styles.target_chip} ${target === opt.value ? styles.target_chip_active : ''}`}
                onClick={() => setTarget(opt.value as typeof target)}
              >
                {t(opt.tKey as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>Заголовок</label>
          <input
            className={styles.notif_input}
            type="text"
            placeholder={t('notifBulkTitlePlaceholder')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={sending}
          />
        </div>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>{t('notifBodyLabel')}</label>
          <textarea
            className={styles.notif_textarea}
            rows={3}
            placeholder={t('notifBulkBodyPlaceholder')}
            value={body}
            onChange={e => setBody(e.target.value)}
            disabled={sending}
          />
        </div>

        <div className={styles.notif_field}>
          <label className={styles.notif_label}>
            {t('notifHtmlLabel')} <span className={styles.notif_optional}>{t('notifHtmlOptional')}</span>
          </label>
          <textarea
            className={styles.notif_textarea}
            rows={4}
            placeholder={t('notifHtmlPlaceholder')}
            value={html}
            onChange={e => setHtml(e.target.value)}
            disabled={sending}
          />
        </div>

        <div className={styles.notif_actions}>
          <button className={styles.send_btn} onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}>
            {sending ? t('notifSending') : t('notifSendBtn')}
          </button>
          {lastResult && (
            <span className={styles.send_success}>
              {t('notifSentResult', {count: lastResult.created})}
            </span>
          )}
        </div>
      </div>

      {/* Telegram */}
      <div className={styles.tg_block}>
        <div className={styles.tg_header}>
          <span className={styles.tg_icon}>✈️</span>
          <div>
            <p className={styles.notif_section_heading} style={{ marginBottom: 2 }}>{t('tgHeading')}</p>
            {tgStats !== null ? (
              <p className={styles.tg_stats}>
                {tgStats.total === 0
                  ? t('tgNoUsers')
                  : t('tgStats', {total: tgStats.total, students: tgStats.students, teachers: tgStats.teachers})}
              </p>
            ) : (
              <p className={styles.tg_stats}>{t('tgLoading')}</p>
            )}
          </div>
        </div>

        {/* Broadcast */}
        <div className={styles.tg_section}>
          <label className={styles.notif_label}>{t('tgBroadcastLabel')}</label>
          <textarea
            className={styles.notif_textarea}
            rows={3}
            placeholder={t('tgBroadcastPlaceholder')}
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
              {tgSending ? t('tgBroadcastSending') : t('tgBroadcastBtn', {count: tgStats?.total ?? 0})}
            </button>
            {tgResult && (
              <span className={styles.tg_result}>
                {t('tgBroadcastResult', {sent: tgResult.sent, failed: tgResult.failed > 0 ? t('tgBroadcastFailed', {count: tgResult.failed}) : ''})}
              </span>
            )}
          </div>
        </div>

        {/* Trigger reminders */}
        <div className={styles.tg_section}>
          <label className={styles.notif_label}>{t('tgTriggerLabel')}</label>
          <p className={styles.tg_hint}>{t('tgTriggerHint')}</p>
          <div className={styles.tg_actions}>
            <button
              className={styles.tg_btn_trigger}
              onClick={handleTgTrigger}
              disabled={tgTriggering}
            >
              {tgTriggering ? t('tgTriggering') : t('tgTriggerBtn')}
            </button>
            {tgTriggerResult && (
              <span className={styles.tg_result}>
                {t('tgTriggerResult', {conferences: tgTriggerResult.conferences, sent: tgTriggerResult.sent})}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className={styles.notif_history}>
        <p className={styles.notif_section_heading}>{t('notifHistoryHeading')}</p>
        {historyLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeleton} style={{ height: 56 }} />)
        ) : history.length === 0 ? (
          <div className={styles.empty}><p>{t('noNotifications')}</p></div>
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
  const t = useTranslations('admin')
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
    if (!form.description.trim()) { toast.error(t('promoDescRequired')); return }
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
      toast.success(t('promoCreated'))
      setShowForm(false)
      setForm({ rewardType: 'FREE_VIP', code: '', autoCode: true, description: '', discountPercent: '', vipDays: '30', maxUses: '', expiresAt: '' })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('promoCreateError'))
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
      toast.success(item.isActive ? t('promoDeactivated') : t('promoActivated'))
    } catch {
      toast.error(t('promoToggleError'))
    }
  }

  const handleDelete = async (item: PromoCodeItem) => {
    if (!confirm(t('promoDeleteConfirm', {code: item.code}))) return
    try {
      const res = await fetch(`/api/admin/promo-codes/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCodes(prev => prev.filter(c => c.id !== item.id))
      toast.success(t('promoDeleted'))
    } catch {
      toast.error(t('promoDeleteError'))
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
      toast.error(t('promoUsagesLoadError'))
    } finally {
      setUsagesLoading(null)
    }
  }

  return (
    <div className={styles.tab_content}>
      <div className={styles.promo_header}>
        <h3 className={styles.promo_section_title}>{t('promoHeading')}</h3>
        <button className={styles.create_promo_btn} onClick={() => setShowForm(p => !p)}>
          {showForm ? t('promoCancel') : t('promoCreate')}
        </button>
      </div>

      {showForm && (
        <div className={styles.promo_form}>
          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>{t('promoTypeLabel')}</label>
            <div className={styles.status_row}>
              {(['FREE_VIP', 'DISCOUNT'] as const).map(t2 => (
                <button
                  key={t2}
                  className={`${styles.status_chip} ${form.rewardType === t2 ? styles.status_chip_active : ''}`}
                  style={form.rewardType === t2 ? { background: '#eef2ff', color: '#6366f1', borderColor: '#6366f144' } : {}}
                  onClick={() => setForm(p => ({ ...p, rewardType: t2 }))}
                >
                  {t2 === 'FREE_VIP' ? t('promoTypeVip') : t('promoTypeDiscount')}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>{t('promoCodeLabel')}</label>
            <div className={styles.promo_code_row}>
              <label className={styles.promo_checkbox_label}>
                <input
                  type="checkbox"
                  checked={form.autoCode}
                  onChange={e => setForm(p => ({ ...p, autoCode: e.target.checked }))}
                />
                {t('promoAutoCode')}
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
            <label className={styles.notif_label}>{t('promoDescLabel')}</label>
            <input className={styles.notif_input} placeholder={t('promoDescPlaceholder')} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          {form.rewardType === 'FREE_VIP' && (
            <div className={styles.promo_form_row}>
              <label className={styles.notif_label}>{t('promoVipDaysLabel')}</label>
              <input className={styles.notif_input} type="number" min="1" placeholder="30" value={form.vipDays} onChange={e => setForm(p => ({ ...p, vipDays: e.target.value }))} />
            </div>
          )}

          {form.rewardType === 'DISCOUNT' && (
            <div className={styles.promo_form_row}>
              <label className={styles.notif_label}>{t('promoDiscountLabel')}</label>
              <input className={styles.notif_input} type="number" min="1" max="100" placeholder="10" value={form.discountPercent} onChange={e => setForm(p => ({ ...p, discountPercent: e.target.value }))} />
            </div>
          )}

          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>{t('promoMaxUsesLabel')} <span className={styles.notif_optional}>{t('promoMaxUsesOptional')}</span></label>
            <input className={styles.notif_input} type="number" min="1" placeholder="100" value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))} />
          </div>

          <div className={styles.promo_form_row}>
            <label className={styles.notif_label}>{t('promoExpiresLabel')} <span className={styles.notif_optional}>{t('promoExpiresOptional')}</span></label>
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
        <div className={styles.empty}><p>{t('promoNone')}</p></div>
      ) : (
        <div className={styles.promo_list}>
          {codes.map(item => (
            <div key={item.id} className={`${styles.promo_card} ${!item.isActive ? styles.promo_card_inactive : ''}`}>
              <div className={styles.promo_card_top}>
                <span className={styles.promo_code_badge}>{item.code}</span>
                <span className={`${styles.promo_type_badge} ${item.rewardType === 'FREE_VIP' ? styles.promo_vip : styles.promo_discount}`}>
                  {item.rewardType === 'FREE_VIP' ? `VIP ${item.vipDays}д` : `−${item.discountPercent}%`}
                </span>
                <span className={styles.promo_uses}>{t('promoUsed', {used: item.usedCount, max: item.maxUses ? `/${item.maxUses}` : ''})}</span>
                <div style={{ flex: 1 }} />
                {/* Copy button */}
                <button
                  className={styles.promo_icon_btn}
                  onClick={() => handleCopy(item)}
                  title={t('promoCopyTitle')}
                >
                  {copiedId === item.id ? (
                    <span className={styles.promo_copied_text}>{t('promoCopied')}</span>
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
                  {item.isActive ? t('promoActive') : t('promoInactive')}
                </button>
                {/* Delete button */}
                <button
                  className={styles.promo_delete_btn}
                  onClick={() => handleDelete(item)}
                  title={t('promoDeleteTitle')}
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
                  {usagesOpen === item.id ? t('promoHideUsages') : t('promoShowUsages')}
                </button>
              </div>
              {usagesOpen === item.id && (
                <div className={styles.promo_usages_panel}>
                  {usagesLoading === item.id ? (
                    <div className={styles.spinner_wrap}><div className={styles.spinner} /></div>
                  ) : !usagesData[item.id] || usagesData[item.id].length === 0 ? (
                    <p className={styles.promo_usages_empty}>{t('promoNoUsages')}</p>
                  ) : (
                    <table className={styles.promo_usages_table}>
                      <thead>
                        <tr>
                          <th>{t('promoUsagesColName')}</th>
                          <th>{t('promoUsagesColEmail')}</th>
                          <th>{t('promoUsagesColRole')}</th>
                          <th>{t('promoUsagesColDate')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usagesData[item.id].map(tx => {
                          const user = tx.teacher ?? tx.student
                          return (
                            <tr key={tx.id}>
                              <td>{user?.name ?? '—'}</td>
                              <td>{user?.email ?? '—'}</td>
                              <td>{tx.userRole === 'TEACHER' ? t('userRoleTeacher') : t('userRoleStudent')}</td>
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
          <h3 className={styles.promo_section_title}>{t('promoServiceHeading')}</h3>
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
                  {t('promoServiceLabel')}<a href={`/service/${item.service.id}`} className={styles.target_link} target="_blank">{item.service.title}</a>
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
  const t = useTranslations('admin')
  const [experiences, setExperiences] = useState<ExperienceVerifItem[]>([])
  const [identities, setIdentities] = useState<IdentityVerifItem[]>([])
  const [loading, setLoading] = useState(true)
  const [passportViewUrl, setPassportViewUrl] = useState<string | null>(null)

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
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? t('expConfirmError')); return }
    const d = await res.json()
    setExperiences(p => p.map(e => e.id === id ? { ...e, verifiedAt: d.experience.verifiedAt } : e))
    toast.success(verify ? t('passportConfirmedToast') : t('passportRemovedToast'))
  }

  const verifyIdentity = async (teacherId: string, verify: boolean) => {
    const res = await fetch(`/api/admin/verifications/identity/${teacherId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify }),
    })
    if (!res.ok) { toast.error(t('passportError')); return }
    setIdentities(p => p.map(i => i.id === teacherId ? { ...i, pasportConfirmed: verify } : i))
    toast.success(verify ? t('passportConfirmedToast') : t('passportRemovedToast'))
  }

  return (
    <div className={styles.tab_content}>
      <h3 className={styles.promo_section_title}>{t('expHeading')}</h3>
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeleton} />)
      ) : experiences.length === 0 ? (
        <div className={styles.empty}><p>{t('expNoRecords')}</p></div>
      ) : (
        <div className={styles.verif_list}>
          {experiences.map(exp => (
            <div key={exp.id} className={styles.verif_card}>
              <div className={styles.verif_card_top}>
                <div className={styles.verif_info}>
                  <span className={styles.verif_name}>{exp.teacher.name}</span>
                  <span className={styles.verif_sub}>{exp.title}{exp.organization ? ` · ${exp.organization}` : ''} · {exp.yearFrom}–{exp.yearTo ?? t('expPresent')}</span>
                </div>
                <div className={styles.verif_actions}>
                  {exp.verifiedAt && (
                    <span className={styles.verif_check} title={t('expVerified', {date: new Date(exp.verifiedAt).toLocaleDateString()})}>✓</span>
                  )}
                  <span className={styles.verif_docs_count} title={exp.documentUrls.length === 0 ? t('expNoDocs') : t('expDocsCount', {count: exp.documentUrls.length})}>
                    {exp.documentUrls.length === 0 ? '📎' : `📎 ${exp.documentUrls.length}`}
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
                    title={!exp.verifiedAt && exp.documentUrls.length === 0 ? t('expNoDocs2') : ''}
                  >
                    {exp.verifiedAt ? t('expRemoveConfirm') : t('expConfirmBtn')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.divider} style={{ margin: '12px 0' }} />
      <h3 className={styles.promo_section_title}>{t('passportHeading')}</h3>
      {loading ? null : identities.length === 0 ? (
        <div className={styles.empty}><p>{t('passportNone')}</p></div>
      ) : (
        <div className={styles.verif_list}>
          {identities.map(item => (
            <div key={item.id} className={`${styles.verif_card} ${item.pasportConfirmed ? styles.verif_card_confirmed : ''}`}>
              <div className={styles.verif_card_top}>
                <div className={styles.verif_info}>
                  <span className={styles.verif_name}>{item.name}</span>
                  <span className={styles.verif_sub}>{item.email}</span>
                  {item.pasportConfirmed && (
                    <span className={styles.passport_confirmed_badge}>{t('passportConfirmedBadge')}</span>
                  )}
                </div>
                <div className={styles.verif_actions}>
                  <button
                    className={styles.passport_thumb_btn}
                    onClick={() => setPassportViewUrl(item.passportDocumentUrl)}
                    title={t('passportView')}
                  >
                    <img src={item.passportDocumentUrl} alt="passport" className={styles.passport_thumb} />
                    <span className={styles.passport_thumb_overlay}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                      </svg>
                    </span>
                  </button>
                  <button
                    className={`${styles.verif_btn} ${item.pasportConfirmed ? styles.verif_btn_active : ''}`}
                    onClick={() => verifyIdentity(item.id, !item.pasportConfirmed)}
                  >
                    {item.pasportConfirmed ? t('passportRemove') : t('passportConfirm')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {passportViewUrl && (
        <div className={styles.passport_modal_overlay} onClick={() => setPassportViewUrl(null)}>
          <div className={styles.passport_modal} onClick={e => e.stopPropagation()}>
            <button className={styles.passport_modal_close} onClick={() => setPassportViewUrl(null)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <img src={passportViewUrl} alt="passport" className={styles.passport_modal_img} />
            <a href={passportViewUrl} target="_blank" rel="noreferrer" className={styles.passport_modal_link}>
              {t('passportOpenTab')}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Content moderation tab ───────────────────────────────

type ContentType = 'posts' | 'roadmaps'
type ModerationStatus = 'PUBLISHED' | 'PENDING' | 'BLOCKED'

const MODERATION_CFG: Record<ModerationStatus, { tKey: string; color: string; bg: string }> = {
  PUBLISHED: { tKey: 'moderPublished', color: '#15803D', bg: '#F0FDF4' },
  PENDING:   { tKey: 'moderPending',   color: '#B45309', bg: '#FFFBEB' },
  BLOCKED:   { tKey: 'moderBlocked',   color: '#A32D2D', bg: '#FCEBEB' },
}

const CONTENT_STATUS_FILTER_KEYS: { value: string; tKey: string }[] = [
  { value: 'all',       tKey: 'filterAll' },
  { value: 'PUBLISHED', tKey: 'moderPublished' },
  { value: 'PENDING',   tKey: 'moderPending' },
  { value: 'BLOCKED',   tKey: 'moderBlocked' },
]

const AI_FILTER_KEYS: { value: string; tKey: string; color: string }[] = [
  { value: 'all',       tKey: 'aiAll',       color: '#6b7280' },
  { value: 'flagged',   tKey: 'aiFlagged',   color: '#dc2626' },
  { value: 'unchecked', tKey: 'aiUnchecked', color: '#d97706' },
  { value: 'ok',        tKey: 'aiOk',        color: '#16a34a' },
]

interface ContentItem {
  id: string
  title: string
  moderationStatus: ModerationStatus
  createdAt: string
  viewCount?: number
  price?: number
  aiModerated?: boolean
  aiModerationOk?: boolean | null
  teacher: { id: string; name: string }
  _count: { comments: number; ratings: number; progress?: number }
}

function ContentTab() {
  const t = useTranslations('admin')
  const [contentType, setContentType] = useState<ContentType>('posts')
  const [statusFilter, setStatusFilter] = useState('all')
  const [aiFilter, setAiFilter] = useState('all')
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchPage = useCallback(async (p: number, type: ContentType, status: string, ai: string, replace = false) => {
    const params = new URLSearchParams({ type, status, aiFilter: ai, page: String(p) })
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
    fetchPage(1, contentType, statusFilter, aiFilter, true).finally(() => setLoading(false))
  }, [contentType, statusFilter, aiFilter, fetchPage])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    await fetchPage(page + 1, contentType, statusFilter, aiFilter)
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
      toast.success(t('contentStatusUpdated'))
    } catch {
      toast.error(t('contentStatusError'))
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (item: ContentItem) => {
    if (!confirm(t('contentDeleteConfirm', {title: item.title}))) return
    setDeleting(item.id)
    try {
      const params = new URLSearchParams({ id: item.id, type: contentType })
      const res = await fetch(`/api/admin/content?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems(prev => prev.filter(i => i.id !== item.id))
      setTotal(prev => prev - 1)
      toast.success(t('contentDeleted'))
    } catch {
      toast.error(t('contentDeleteError'))
    } finally {
      setDeleting(null)
    }
  }

  const statusActions = (['PUBLISHED', 'PENDING', 'BLOCKED'] as ModerationStatus[]).map(s => ({
    status: s,
    label: t(MODERATION_CFG[s].tKey as Parameters<typeof t>[0]),
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
            {t('contentPosts')}
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
        {CONTENT_STATUS_FILTER_KEYS.map(f => (
          <button
            key={f.value}
            className={`${styles.filter_tab} ${statusFilter === f.value ? styles.filter_tab_active : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {t(f.tKey as Parameters<typeof t>[0])}
          </button>
        ))}
        {total > 0 && <span className={styles.total_badge}>{total}</span>}
      </div>

      {contentType === 'posts' && (
        <div className={styles.filter_tabs} style={{marginTop: 6}}>
          {AI_FILTER_KEYS.map(f => (
            <button
              key={f.value}
              className={`${styles.filter_tab} ${aiFilter === f.value ? styles.filter_tab_active : ''}`}
              style={aiFilter === f.value ? {borderColor: f.color, color: f.color} : {}}
              onClick={() => setAiFilter(f.value)}
            >
              {t(f.tKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      )}

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
            <p>{t('noContent')}</p>
          </div>
        ) : (
          items.map(item => {
            const cfg = { ...MODERATION_CFG[item.moderationStatus] ?? MODERATION_CFG.PUBLISHED, label: t((MODERATION_CFG[item.moderationStatus] ?? MODERATION_CFG.PUBLISHED).tKey as Parameters<typeof t>[0]) }
            const href = contentType === 'posts' ? `/post/${item.id}` : `/road-map/${item.id}`
            return (
              <div key={item.id} className={styles.content_card}>
                <div className={styles.content_card_left}>
                  <Link href={href} className={styles.content_card_title} target="_blank" rel="noreferrer">
                    {item.title || t('noTitle')}
                  </Link>
                  <div className={styles.content_card_meta}>
                    <span>{item.teacher.name}</span>
                    <span>·</span>
                    <span>{fmt(item.createdAt)}</span>
                    {contentType === 'posts' && item.viewCount !== undefined && (
                      <>
                        <span>·</span>
                        <span>{t('viewCount', {count: item.viewCount})}</span>
                      </>
                    )}
                    {contentType === 'roadmaps' && item._count.progress !== undefined && (
                      <>
                        <span>·</span>
                        <span>{t('studentsCount', {count: item._count.progress})}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{t('commentsCount', {count: item._count.comments})}</span>
                  </div>
                </div>
                <div className={styles.content_card_right}>
                  <span
                    className={styles.status_badge}
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                  {contentType === 'posts' && item.aiModerated && (
                    <span
                      className={styles.status_badge}
                      style={item.aiModerationOk
                        ? { color: '#16a34a', background: '#f0fdf4' }
                        : { color: '#dc2626', background: '#fef2f2' }}
                      title={item.aiModerationOk ? t('aiOkTooltip') : t('aiViolationTooltip')}
                    >
                      {item.aiModerationOk ? t('aiOkBadge') : t('aiViolationBadge')}
                    </span>
                  )}
                  {contentType === 'posts' && !item.aiModerated && (
                    <span
                      className={styles.status_badge}
                      style={{ color: '#9ca3af', background: '#f9fafb' }}
                      title={t('aiNotChecked')}
                    >
                      {t('aiNotCheckedBadge')}
                    </span>
                  )}
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
                    {deleting === item.id ? t('contentDeleting') : t('contentDelete')}
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

function daysSince(iso: string | null): { key: string; n?: number } {
  if (!iso) return { key: 'userLastVisitNever' }
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return { key: 'userLastVisitToday' }
  return { key: 'userLastVisitDays', n: diff }
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
  const t = useTranslations('admin')
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
      toast.success(t('userUpdated'))
    } catch {
      toast.error(t('userUpdateError'))
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
    if (!confirm(t('userDeleteConfirm', {name: item.name}))) return
    setProcessing(true)
    try {
      const params = new URLSearchParams({ id: item.id, role: item.role })
      const res = await fetch(`/api/admin/users?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDelete(item.id, item.role)
      toast.success(t('userDeleted'))
    } catch {
      toast.error(t('userDeleteError'))
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
            {isTeacher ? t('userRoleTeacher') : t('userRoleStudent')}
          </span>
          {item.isVip && (
            <span className={styles.user_badge} style={{ background: '#fef9ee', color: '#d97706' }}>
              VIP
            </span>
          )}
          {item.isBanned && (
            <span className={styles.user_badge} style={{ background: '#fef2f2', color: '#dc2626' }}>
              {t('userBanned')}
            </span>
          )}
        </div>

        <div className={styles.user_stats}>
          {t('userLastVisit')}{(() => { const d = daysSince(item.lastSeenAt); return t(d.key as Parameters<typeof t>[0], d.n !== undefined ? {n: d.n} : undefined) })()}
          {' · '}
          {t('userReg')}{fmt(item.createdAt)}
          {isTeacher && (
            <>
              {' · '}
              {t('userPosts', {count: item._count.posts ?? 0})} · {t('userRoadmaps', {count: item._count.roadmaps ?? 0})} · {t('userStudentsOf', {count: item._count.students ?? 0})}
            </>
          )}
          {!isTeacher && (
            <>
              {' · '}
              {t('userTeachersOf', {count: item._count.teachers ?? 0})}
            </>
          )}
        </div>

        {item.isBanned && item.banReason && (
          <div className={styles.user_stats} style={{ color: '#dc2626' }}>
            {t('userBanReason')}{item.banReason}
          </div>
        )}

        {/* Inline ban form */}
        {banOpen && (
          <div className={styles.ban_form}>
            <textarea
              className={styles.ban_textarea}
              rows={2}
              placeholder={t('banPlaceholder')}
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
                {processing ? t('banProcessing') : t('banConfirmBtn')}
              </button>
              <button
                className={styles.filter_tab}
                onClick={() => { setBanOpen(false); setBanReasonInput('') }}
                disabled={processing}
              >
                {t('banCancel')}
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
              {t('banBtn')}
            </button>
          ) : (
            <button
              className={styles.unban_btn}
              onClick={handleUnban}
              disabled={processing}
            >
              {t('unbanBtn')}
            </button>
          )}
          <button
            className={styles.vip_btn}
            onClick={handleVipToggle}
            disabled={processing}
          >
            {item.isVip ? t('vipRemoveBtn') : t('vipAddBtn')}
          </button>
        </div>
        <div className={styles.user_action_row} style={{ justifyContent: 'flex-end' }}>
          <button
            className={styles.delete_user_btn}
            onClick={handleDelete}
            disabled={processing}
          >
            {t('deleteUserBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const t = useTranslations('admin')
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

  const ROLE_OPTS: { value: 'all' | 'TEACHER' | 'STUDENT'; tKey: string }[] = [
    { value: 'all',     tKey: 'roleAll' },
    { value: 'TEACHER', tKey: 'roleTeachers' },
    { value: 'STUDENT', tKey: 'roleStudents' },
  ]

  const STATUS_OPTS: { value: 'all' | 'active' | 'banned' | 'vip'; tKey: string }[] = [
    { value: 'all',    tKey: 'statusAll' },
    { value: 'active', tKey: 'statusActive' },
    { value: 'banned', tKey: 'statusBanned' },
    { value: 'vip',    tKey: 'statusVip' },
  ]

  return (
    <div className={styles.tab_content}>
      {/* Search + filters */}
      <div className={styles.users_search_row}>
        <input
          className={styles.users_search_input}
          type="text"
          placeholder={t('userSearchPlaceholder')}
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
              {t(o.tKey as Parameters<typeof t>[0])}
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
              {t(o.tKey as Parameters<typeof t>[0])}
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
            <p>{t('noUsers')}</p>
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
  const t = useTranslations('admin')
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
        <div className={styles.empty}><p>{t('statsLoadError')}</p></div>
      </div>
    )
  }

  const { users, content, complaints, promos, recentTransactions } = data

  return (
    <div className={styles.tab_content}>
      {/* Users section */}
      <div className={styles.stats_section}>
        <p className={styles.stats_section_title}>{t('statsUsers')}</p>
        <div className={styles.stats_grid}>
          <StatCard title={t("statsStudents")} value={users.totalStudents} sub={t("statsSubWeek", {count: users.newStudentsWeek})} subColor="#16a34a" />
          <StatCard title={t("statsTeachers")} value={users.totalTeachers} sub={t("statsSubWeek", {count: users.newTeachersWeek})} subColor="#16a34a" />
          <StatCard title={t("statsVipTotal")} value={users.vipStudents + users.vipTeachers} sub={t("statsSubVip", {s: users.vipStudents, t: users.vipTeachers})} />
          <StatCard title={t("statsNewMonth")} value={users.newStudentsMonth + users.newTeachersMonth} sub={t("statsSubNewMonth", {s: users.newStudentsMonth, t: users.newTeachersMonth})} subColor="#6366f1" />
          <StatCard title={t("statsBanned")} value={users.bannedStudents + users.bannedTeachers} sub={t("statsSubBanned", {s: users.bannedStudents, t: users.bannedTeachers})} subColor={users.bannedStudents + users.bannedTeachers > 0 ? '#dc2626' : undefined} />
        </div>
      </div>

      {/* Content section */}
      <div className={styles.stats_section}>
        <p className={styles.stats_section_title}>{t('statsContent')}</p>
        <div className={styles.stats_content_row}>
          <div className={styles.stats_content_block}>
            <span className={styles.stats_content_label}>{t('statsPosts')}</span>
            <div className={styles.stats_content_pills}>
              <span className={styles.stats_pill} style={{ background: '#F0FDF4', color: '#15803D' }}>{t('statsPublished', {n: content.publishedPosts})}</span>
              <span className={styles.stats_pill} style={{ background: '#FFFBEB', color: '#B45309' }}>{t('statsPending', {n: content.pendingPosts})}</span>
              <span className={styles.stats_pill} style={{ background: '#FCEBEB', color: '#A32D2D' }}>{t('statsBlocked', {n: content.blockedPosts})}</span>
            </div>
          </div>
          <div className={styles.stats_content_block}>
            <span className={styles.stats_content_label}>Road-maps</span>
            <div className={styles.stats_content_pills}>
              <span className={styles.stats_pill} style={{ background: '#F0FDF4', color: '#15803D' }}>{t('statsPublished', {n: content.publishedRoadmaps})}</span>
              <span className={styles.stats_pill} style={{ background: '#FFFBEB', color: '#B45309' }}>{t('statsPending', {n: content.pendingRoadmaps})}</span>
              <span className={styles.stats_pill} style={{ background: '#FCEBEB', color: '#A32D2D' }}>{t('statsBlocked', {n: content.blockedRoadmaps})}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className={styles.stats_grid}>
        <StatCard title={t("statsComplaintsPending")} value={complaints.pending} sub={t("statsComplaintsOf", {total: complaints.total})} subColor={complaints.pending > 0 ? '#f59e0b' : undefined} />
        <StatCard title={t("statsPromoActive")} value={promos.active} sub={t("statsPromoOf", {total: promos.total})} />
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <div className={styles.stats_section}>
          <p className={styles.stats_section_title}>{t('statsVipTx')}</p>
          <div className={styles.stats_tx_list}>
            {recentTransactions.map(tx => {
              const user = tx.teacher ?? tx.student
              return (
                <div key={tx.id} className={styles.stats_tx_item}>
                  <span className={styles.stats_tx_name}>{user?.name ?? '—'}</span>
                  <span className={styles.stats_tx_role}>{tx.userRole === 'TEACHER' ? t('userRoleTeacher') : t('userRoleStudent')}</span>
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
  const t = useTranslations('admin')
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
    if (!newEmail.trim()) { toast.error(t('adminEmailsEmailRequired')); return }
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
      toast.success(t('adminEmailsAdded'))
      setNewEmail('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminEmailsAddError'))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (item: AdminEmailItem) => {
    if (!confirm(t('adminEmailsDeleteConfirm', {email: item.email}))) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/admin/admin-emails?id=${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Ошибка')
      }
      toast.success(t('adminEmailsDeleted'))
      setEmails(prev => prev.filter(e => e.id !== item.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('adminEmailsDeleteError'))
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
        <span>{t('adminEmailsWarning')}</span>
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
          {adding ? t('adminEmailsAdding') : t('adminEmailsAdd')}
        </button>
      </div>

      {/* List */}
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeleton} style={{ height: 52 }} />)
      ) : emails.length === 0 ? (
        <div className={styles.empty}><p>{t('adminEmailsNone')}</p></div>
      ) : (
        <div className={styles.admin_emails_list}>
          {emails.map(item => {
            const isMe = item.email.toLowerCase() === currentEmail.toLowerCase()
            return (
              <div key={item.id} className={styles.admin_email_row}>
                <div className={styles.admin_email_info}>
                  <span className={styles.admin_email_addr}>{item.email}</span>
                  {isMe && <span className={styles.admin_email_me}>{t('adminEmailsMe')}</span>}
                  <span className={styles.admin_email_date}>{fmt(item.createdAt)}</span>
                </div>
                <button
                  className={styles.admin_email_delete_btn}
                  onClick={() => handleDelete(item)}
                  disabled={isMe || deletingId === item.id}
                  title={isMe ? t('adminEmailsSelfTitle') : t('adminEmailsDeleteTitle')}
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
  const t = useTranslations('admin')
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<AdminTab>('stats')

  if (status === 'loading') {
    return (
      <div className={`container default_content ${styles.page_wrap}`}>
        <NavBar />
        <div className={styles.loading}>{t('loading')}</div>
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
          <p>{t('forbidden')}</p>
          <span>{t('forbiddenSub')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`container default_content ${styles.page_wrap}`}>
      <NavBar />
      <div className={styles.content}>
        <div className={styles.page_header}>
          <h1 className={styles.page_title}>{t('pageTitle')}</h1>
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
            {t('tabStats')}
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'users' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {t('tabUsers')}
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
            {t('tabContent')}
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'complaints' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('complaints')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {t('tabComplaints')}
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
            {t('tabPromo')}
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'notifications' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {t('tabNotifications')}
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'verifications' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('verifications')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {t('tabVerifications')}
          </button>
          <button
            className={`${styles.main_tab} ${activeTab === 'admin-emails' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('admin-emails')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t('tabAdminEmails')}
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
