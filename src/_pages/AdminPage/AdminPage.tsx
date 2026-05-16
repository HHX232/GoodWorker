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

function PromoCodesTab() {
  const [codes, setCodes] = useState<PromoCodeItem[]>([])
  const [serviceCodes, setServiceCodes] = useState<ServicePromoCodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

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
                <button
                  className={`${styles.promo_toggle_btn} ${item.isActive ? styles.promo_toggle_active : ''}`}
                  onClick={() => toggleActive(item)}
                >
                  {item.isActive ? 'Активен' : 'Неактивен'}
                </button>
              </div>
              <p className={styles.promo_desc}>{item.description}</p>
              {item.expiresAt && (
                <span className={styles.promo_expires}>до {new Date(item.expiresAt).toLocaleDateString('ru')}</span>
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

// ─── Page ─────────────────────────────────────────────────

type AdminTab = 'complaints' | 'notifications' | 'promo' | 'verifications'

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
            className={`${styles.main_tab} ${activeTab === 'verifications' ? styles.main_tab_active : ''}`}
            onClick={() => setActiveTab('verifications')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Верификации
          </button>
        </div>

        {activeTab === 'complaints' && <ComplaintsTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'promo' && <PromoCodesTab />}
        {activeTab === 'verifications' && <VerificationsTab />}
      </div>
    </div>
  )
}
