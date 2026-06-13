'use client'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {useEffect, useRef, useState} from 'react'
import {RoadmapNodeProgress} from './RoadmapNodeProgress'
import type {OutlineStep} from '@/shared/lib/roadmapOutline'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {useTranslations} from 'next-intl'
import {toast} from 'sonner'
import {RoadmapFeedbackDetailModal} from '../RoadmapFeedbackDetailModal/RoadmapFeedbackDetailModal'
import styles from './RoadmapStatsModal.module.scss'

// ─── Types ───────────────────────────────────────────────

interface PeriodPoint {
  week: string
  count: number
  income?: number
}

interface ComplaintItem {
  id: string
  status: string
  text: string
  reply: string | null
  repliedAt: string | null
  createdAt: string
}

interface StatsData {
  views: {total: number; byPeriod: PeriodPoint[]}
  comments: {total: number; byPeriod: PeriodPoint[]}
  complaints: {total: number; open: number; items: ComplaintItem[]}
  purchases: {total: number; totalIncome: number; price: number; byPeriod: PeriodPoint[]}
  feedback: {nodeId: string; questions: unknown[]; submissionCount: number; submissions: {answers: unknown}[]}[]
  testResults: {nodeId: string; submissionCount: number; avgPercent: number | null}[]
  nodeProgress: Record<string, number>
  totalProgressStudents: number
}

// ─── Helpers ─────────────────────────────────────────────

function formatWeek(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', {day: '2-digit', month: '2-digit', year: '2-digit'})
}

// ─── SVG Icons ────────────────────────────────────────────

function IconViews() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  )
}

function IconIncome() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <line x1='12' y1='1' x2='12' y2='23' />
      <path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' />
    </svg>
  )
}

function IconComplaints() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
      <line x1='12' y1='9' x2='12' y2='13' />
      <line x1='12' y1='17' x2='12.01' y2='17' />
    </svg>
  )
}

function IconTests() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
      <line x1='16' y1='13' x2='8' y2='13' />
      <line x1='16' y1='17' x2='8' y2='17' />
      <polyline points='10 9 9 9 8 9' />
    </svg>
  )
}

function IconFeedback() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
    </svg>
  )
}

// ─── Combined views+comments tooltip ─────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CombinedTooltip({active, payload, label}: any) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <span>{formatWeek(label)}</span>
      {payload.map((p: {name: string; value: number; color: string}) => (
        <span key={p.name} style={{color: p.name === 'Просмотры' ? '#a5b4fc' : '#d1d5db', fontWeight: 600}}>
          {p.name}: {p.value}
        </span>
      ))}
    </div>
  )
}

// ─── Income tooltip ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IncomeTooltip({active, payload, label}: any) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <span>{formatWeek(label)}</span>
      <strong>{payload[0].value.toLocaleString('ru')} ₽</strong>
    </div>
  )
}

// ─── Percent badge ────────────────────────────────────────

function percentClass(p: number | null): string {
  if (p === null) return styles.mid
  if (p >= 70) return styles.high
  if (p >= 40) return styles.mid
  return styles.low
}

// ─── Complaints list modal ────────────────────────────────

const PAGE_SIZE = 15

function statusLabel(status: string, t: (k: string) => string): {text: string; color: string} {
  if (status === 'closed' || status === 'resolved') return {text: t('complaintStatusClosed'), color: '#22c55e'}
  if (status === 'in_progress') return {text: t('complaintStatusInProgress'), color: '#f59e0b'}
  if (status === 'answered') return {text: t('complaintStatusAnswered'), color: '#6366f1'}
  return {text: t('complaintStatusOpen'), color: '#f43f5e'}
}

function ComplaintRow({item, t}: {item: ComplaintItem; t: (k: string) => string}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const {text, color} = statusLabel(item.status, t)

  const handleReply = async () => {
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/complaints/${item.id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reply: replyText.trim()}),
      })
      if (!res.ok) throw new Error()
      toast.success(t('complaintReplySuccess'))
      setReplyOpen(false)
      setReplyText('')
    } catch {
      toast.error(t('complaintReplyError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.complaint_item}>
      <div className={styles.complaint_item_header}>
        <span className={styles.complaint_status} style={{color}}>● {text}</span>
        <span className={styles.complaint_date}>{formatDate(item.createdAt)}</span>
      </div>
      <p className={styles.complaint_text}>{item.text}</p>

      {item.reply && (
        <div className={styles.complaint_reply_box}>
          <span className={styles.complaint_reply_label}>{t('complaintReplied')}</span>
          <p className={styles.complaint_reply_text}>{item.reply}</p>
        </div>
      )}

      {!item.reply && (item.status === 'pending' || item.status === 'in_progress') && (
        replyOpen ? (
          <div className={styles.complaint_reply_form}>
            <textarea
              className={styles.complaint_reply_textarea}
              placeholder={t('complaintReplyPlaceholder')}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
            />
            <div className={styles.complaint_reply_actions}>
              <button
                className={styles.reply_cancel_btn}
                onClick={() => { setReplyOpen(false); setReplyText('') }}
                disabled={submitting}
              >
                {t('complaintReplyCancel')}
              </button>
              <button
                className={styles.reply_send_btn}
                onClick={handleReply}
                disabled={submitting || !replyText.trim()}
              >
                {t('complaintReplySend')}
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.complaint_reply_btn} onClick={() => setReplyOpen(true)}>
            {t('complaintReplyBtn')}
          </button>
        )
      )}
    </div>
  )
}

function ComplaintsListModal({
  isOpen,
  onClose,
  items,
}: {
  isOpen: boolean
  onClose: () => void
  items: ComplaintItem[]
}) {
  const t = useTranslations('roadMap')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) { setVisible(PAGE_SIZE); return }
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible((v) => v + PAGE_SIZE) },
      {threshold: 0.1}
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [isOpen])

  const shown = items.slice(0, visible)

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={(e) => { onClose(); e.stopPropagation?.() }}
      additionalTitle={<span style={{fontWeight: 700, fontSize: 16}}>{t('complaintsTitle', {count: items.length})}</span>}
    >
      <div className={styles.complaints_list_wrap}>
        {items.length === 0 ? (
          <p className={styles.empty_hint}>{t('complaintsEmpty')}</p>
        ) : (
          <>
            {shown.map((c) => (
              <ComplaintRow key={c.id} item={c} t={t} />
            ))}
            {visible < items.length && (
              <div ref={sentinelRef} className={styles.sentinel} />
            )}
          </>
        )}
      </div>
    </ModalWindowDefault>
  )
}

// ─── Main stats modal ─────────────────────────────────────

export function RoadmapStatsModal({roadmapId, isOpen, onClose}: {roadmapId: string; isOpen: boolean; onClose: () => void}) {
  const t = useTranslations('roadMap')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [complaintsOpen, setComplaintsOpen] = useState(false)
  const [outlineSteps, setOutlineSteps] = useState<OutlineStep[] | null>(null)

  useEffect(() => {
    if (!isOpen || stats) return
    setLoading(true)
    Promise.all([
      fetch(`/api/roadmap/${roadmapId}/stats`).then((r) => r.json()),
      fetch(`/api/roadmap/${roadmapId}/outline`).then((r) => r.json()),
    ])
      .then(([statsData, outlineData]) => {
        setStats(statsData)
        setOutlineSteps(outlineData.steps ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen, roadmapId, stats])

  const combinedData = stats
    ? stats.views.byPeriod.map((v, i) => ({
        week: v.week,
        'Просмотры': v.count,
        'Комментарии': stats.comments.byPeriod[i]?.count ?? 0,
      }))
    : []

  return (
    <>
      <ModalWindowDefault
        isOpen={isOpen}
        onClose={(e) => { onClose(); e.stopPropagation?.() }}
        additionalTitle={<span style={{fontWeight: 700, fontSize: 16}}>{t('statsTitle')}</span>}
      >
        {loading || !stats ? (
          <div className={styles.loading}>{t('statsLoading')}</div>
        ) : (
          <div className={styles.wrap}>

            {/* Views + Comments combined */}
            <section className={styles.section}>
              <div className={styles.section_header}>
                <span className={styles.section_title}><IconViews /> {t('statsViewsComments')}</span>
                <span className={styles.section_sub}>{t('statsLast8Weeks')}</span>
              </div>
              <div className={styles.chips}>
                <div className={styles.chip}>
                  <span className={styles.chip_dot} style={{background: '#6366f1'}} />
                  {t('statsViews')}: <strong>{stats.views.total}</strong>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chip_dot} style={{background: '#141416'}} />
                  {t('statsComments')}: <strong>{stats.comments.total}</strong>
                </div>
              </div>
              <div className={styles.chart_wrap}>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={combinedData} barCategoryGap='25%' barGap={3}>
                    <CartesianGrid vertical={false} stroke='#f0f0f0' strokeDasharray='0' />
                    <XAxis
                      dataKey='week'
                      tickFormatter={formatWeek}
                      tick={{fontSize: 10, fill: '#bbb'}}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{fontSize: 10, fill: '#bbb'}}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CombinedTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
                    <Legend
                      wrapperStyle={{fontSize: 11, paddingTop: 8}}
                      formatter={(value) => <span style={{color: '#868897'}}>{value}</span>}
                    />
                    <Bar dataKey='Просмотры' fill='#6366f1' radius={[3, 3, 0, 0]} animationDuration={500} />
                    <Bar dataKey='Комментарии' fill='#141416' radius={[3, 3, 0, 0]} animationDuration={500} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <hr className={styles.divider} />

            {/* Income */}
            {stats.purchases.price > 0 && (
              <>
                <section className={styles.section}>
                  <div className={styles.section_header}>
                    <span className={styles.section_title}><IconIncome /> {t('statsIncome')}</span>
                    <span className={styles.section_sub}>{t('statsLast8Weeks')}</span>
                  </div>
                  <div className={styles.chips}>
                    <div className={styles.chip}>{t('statsPurchases')}: <strong>{stats.purchases.total}</strong></div>
                    <div className={styles.chip}>{t('statsTotal')}: <strong>{stats.purchases.totalIncome.toLocaleString('ru')} ₽</strong></div>
                    <div className={styles.chip}>{t('statsPrice')}: <strong>{stats.purchases.price} ₽</strong></div>
                  </div>
                  <div className={styles.chart_wrap}>
                    <ResponsiveContainer width='100%' height='100%'>
                      <BarChart data={stats.purchases.byPeriod} barCategoryGap='30%'>
                        <CartesianGrid vertical={false} stroke='#f0f0f0' strokeDasharray='0' />
                        <XAxis dataKey='week' tickFormatter={formatWeek} tick={{fontSize: 10, fill: '#bbb'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 10, fill: '#bbb'}} axisLine={false} tickLine={false} width={36} allowDecimals={false} tickFormatter={(v) => `${v}₽`} />
                        <Tooltip content={<IncomeTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
                        <Bar dataKey='income' fill='#22c55e' radius={[4, 4, 0, 0]} animationDuration={500} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <hr className={styles.divider} />
              </>
            )}

            {/* Complaints */}
            <section className={styles.section}>
              <div className={styles.section_header}>
                <span className={styles.section_title}><IconComplaints /> {t('statsComplaints')}</span>
              </div>
              <div className={styles.complaints_row}>
                <div className={`${styles.complaints_badge} ${stats.complaints.open === 0 ? styles.ok : styles.warn}`}>
                  <span className={styles.complaints_dot} />
                  {stats.complaints.open === 0
                    ? t('statsNoComplaints', {total: stats.complaints.total})
                    : t('statsOpenComplaints', {open: stats.complaints.open, total: stats.complaints.total})}
                </div>
                {stats.complaints.total > 0 && (
                  <button className={styles.feedback_btn} onClick={() => setComplaintsOpen(true)}>
                    {t('statsViewComplaints')}
                  </button>
                )}
              </div>
            </section>

            {/* Test results */}
            {stats.testResults.length > 0 && (
              <>
                <hr className={styles.divider} />
                <section className={styles.section}>
                  <div className={styles.section_header}>
                    <span className={styles.section_title}><IconTests /> {t('statsTests')}</span>
                    <span className={styles.section_sub}>
                      {t('statsTestsCount', {count: stats.testResults.reduce((s, t2) => s + t2.submissionCount, 0)})}
                    </span>
                  </div>
                  <div className={styles.test_table}>
                    {stats.testResults.map((tr, i) => (
                      <div key={tr.nodeId} className={styles.test_row}>
                        <span className={styles.test_row_label}>{t('statsTestBlock', {num: i + 1})}</span>
                        <div className={styles.test_row_stats}>
                          <span className={styles.test_row_count}>{tr.submissionCount} {t('statsTestRuns')}</span>
                          {tr.avgPercent !== null ? (
                            <span className={`${styles.test_percent} ${percentClass(tr.avgPercent)}`}>
                              avg {tr.avgPercent}%
                            </span>
                          ) : (
                            <span className={styles.test_percent}>—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Node progress plan */}
            {outlineSteps && outlineSteps.length > 0 && (
              <>
                <hr className={styles.divider} />
                <section className={styles.section}>
                  <div className={styles.section_header}>
                    <span className={styles.section_title}>
                      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                        <line x1='8' y1='6' x2='21' y2='6'/><line x1='8' y1='12' x2='21' y2='12'/><line x1='8' y1='18' x2='21' y2='18'/>
                        <line x1='3' y1='6' x2='3.01' y2='6'/><line x1='3' y1='12' x2='3.01' y2='12'/><line x1='3' y1='18' x2='3.01' y2='18'/>
                      </svg>
                      {t('statsNodeProgress')}
                    </span>
                    {stats.totalProgressStudents > 0 && (
                      <span className={styles.section_sub}>{t('statsNodeProgressStudents', {count: stats.totalProgressStudents})}</span>
                    )}
                  </div>
                  <RoadmapNodeProgress
                    steps={outlineSteps}
                    nodeProgress={stats.nodeProgress}
                    totalStudents={stats.totalProgressStudents}
                  />
                </section>
              </>
            )}

            {/* Feedback */}
            <hr className={styles.divider} />
            <section className={styles.section}>
              <span className={styles.section_title}><IconFeedback /> {t('statsFeedback')}</span>
              {stats.feedback.length === 0 ? (
                <p className={styles.empty_hint}>{t('statsNoFeedback')}</p>
              ) : (
                <>
                  <div className={styles.chips}>
                    <div className={styles.chip}>{t('statsFeedbackBlocks')}: <strong>{stats.feedback.length}</strong></div>
                    <div className={styles.chip}>
                      {t('statsFeedbackAnswers')}: <strong>{stats.feedback.reduce((s, f) => s + f.submissionCount, 0)}</strong>
                    </div>
                  </div>
                  <button className={styles.feedback_btn} onClick={() => setFeedbackOpen(true)}>
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                      <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
                    </svg>
                    {t('statsViewFeedback')}
                  </button>
                </>
              )}
            </section>

          </div>
        )}
      </ModalWindowDefault>

      {stats && (
        <>
          <RoadmapFeedbackDetailModal
            isOpen={feedbackOpen}
            onClose={() => setFeedbackOpen(false)}
            feedback={stats.feedback}
          />
          <ComplaintsListModal
            isOpen={complaintsOpen}
            onClose={() => setComplaintsOpen(false)}
            items={stats.complaints.items ?? []}
          />
        </>
      )}
    </>
  )
}
