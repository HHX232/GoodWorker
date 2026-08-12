'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {useThemeCtx} from '@/app/providers/ThemeContext'
import styles from './StudentReportPage.module.scss'

interface ReportData {
  student: {
    name: string
    email: string
    avatarUrl: string | null
    createdAt: string
  } | null
  teacher: { name: string } | null
  totalErrors: number
  totalCorrected: number
  totalAttempts: number
  avgScore: number | null
  totalCalls: number
  totalPostViews: number
  errorsByCategory: { name: string; count: number }[]
  errorsOverTime: { week: string; count: number }[]
  attemptsOverTime: { week: string; avgScore: number | null; count: number }[]
}

interface Props {
  studentId: string
}

type Lang = 'ru' | 'en' | 'zh' | 'hi'

type View = 'report' | 'homework'

interface HWItem {
  id: string
  title: string
  dueAt: string | null
  status: string
  grade: number | null
  href: string
}

const HW_STATUS_LABELS: Record<string, Record<string, string>> = {
  ru: { PENDING: 'Не начато', IN_PROGRESS: 'В процессе', SUBMITTED: 'Сдано', REVIEWED: 'Проверено' },
  en: { PENDING: 'Not started', IN_PROGRESS: 'In progress', SUBMITTED: 'Submitted', REVIEWED: 'Reviewed' },
  zh: { PENDING: '未开始', IN_PROGRESS: '进行中', SUBMITTED: '已提交', REVIEWED: '已批改' },
  hi: { PENDING: 'शुरू नहीं', IN_PROGRESS: 'प्रगति में', SUBMITTED: 'जमा किया', REVIEWED: 'समीक्षित' },
}

const HW_STATUS_COLORS: Record<string, string> = {
  PENDING: '#94a3b8', IN_PROGRESS: '#f59e0b', SUBMITTED: '#10b981', REVIEWED: '#6366f1',
}

const T = {
  ru: {
    loading: 'Загрузка отчёта...',
    title: 'Отчёт об успеваемости',
    teacher: 'Преподаватель',
    date: 'Дата',
    period: 'Период: последние 12 недель',
    errors: 'Ошибок совершено',
    corrected: 'Ошибок исправлено',
    corrRate: 'Процент исправления',
    avgScore: 'Средний балл тестов',
    calls: 'Занятий проведено',
    errWeekly: 'Ошибки по неделям',
    scoreWeekly: 'Средний балл тестов по неделям',
    topErrors: 'Топ категорий ошибок',
    download: 'Скачать PDF',
    errLine: 'Ошибок',
    scoreLine: 'Средний балл',
    dateLocale: 'ru-RU',
  },
  en: {
    loading: 'Loading report...',
    title: 'Progress Report',
    teacher: 'Teacher',
    date: 'Date',
    period: 'Period: last 12 weeks',
    errors: 'Errors made',
    corrected: 'Errors corrected',
    corrRate: 'Correction rate',
    avgScore: 'Average test score',
    calls: 'Lessons conducted',
    errWeekly: 'Errors by week',
    scoreWeekly: 'Average test score by week',
    topErrors: 'Top error categories',
    download: 'Download PDF',
    errLine: 'Errors',
    scoreLine: 'Avg score',
    dateLocale: 'en-US',
  },
  zh: {
    loading: '报告加载中...',
    title: '学习进度报告',
    teacher: '教师',
    date: '日期',
    period: '期间：最近12周',
    errors: '错误次数',
    corrected: '已纠正错误',
    corrRate: '纠正率',
    avgScore: '测试平均分',
    calls: '已完成课程',
    errWeekly: '每周错误',
    scoreWeekly: '每周测试平均分',
    topErrors: '主要错误类别',
    download: '下载PDF',
    errLine: '错误',
    scoreLine: '平均分',
    dateLocale: 'zh-CN',
  },
  hi: {
    loading: 'रिपोर्ट लोड हो रही है...',
    title: 'प्रगति रिपोर्ट',
    teacher: 'शिक्षक',
    date: 'दिनांक',
    period: 'अवधि: पिछले 12 सप्ताह',
    errors: 'गलतियाँ की गईं',
    corrected: 'गलतियाँ सुधारी गईं',
    corrRate: 'सुधार दर',
    avgScore: 'टेस्ट औसत अंक',
    calls: 'कक्षाएं आयोजित',
    errWeekly: 'साप्ताहिक गलतियाँ',
    scoreWeekly: 'साप्ताहिक औसत टेस्ट अंक',
    topErrors: 'शीर्ष गलती श्रेणियाँ',
    download: 'PDF डाउनलोड करें',
    errLine: 'गलतियाँ',
    scoreLine: 'औसत अंक',
    dateLocale: 'hi-IN',
  },
} as const

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function StudentReportPage({ studentId }: Props) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('ru')
  const [view, setView] = useState<View>('report')
  const [homeworks, setHomeworks] = useState<HWItem[]>([])
  const [hwLoading, setHwLoading] = useState(false)
  const {isDark} = useThemeCtx()

  const ch = {
    grid:       isDark ? 'rgba(255,255,255,0.08)' : '#E5E5E5',
    tick:       isDark ? 'rgba(255,255,255,0.35)' : '#888',
    tickDark:   isDark ? 'rgba(255,255,255,0.45)' : '#555',
    line1:      isDark ? '#a5b4fc' : '#111118',
    line2:      isDark ? 'rgba(255,255,255,0.45)' : '#555',
    bar:        isDark ? '#818cf8' : '#333',
    tooltipBg:  isDark ? '#1e2030' : '#fff',
    tooltipBdr: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0',
    tooltipLbl: isDark ? '#e8eaf0' : '#111118',
  }

  const t = T[lang]

  useEffect(() => {
    fetch(`/api/teacher/student-report/${studentId}`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error ?? 'Ошибка загрузки данных')
        }
        return r.json()
      })
      .then((d: ReportData) => setData(d))
      .catch(e => setError(e.message ?? 'Ошибка'))
      .finally(() => setLoading(false))
  }, [studentId])

  useEffect(() => {
    if (view !== 'homework' || homeworks.length > 0) return
    setHwLoading(true)
    fetch(`/api/homework/student?studentId=${studentId}`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d.assignments) ? d.assignments : []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setHomeworks(list.map((a: any) => ({
          id: a.id,
          title: a.homework?.title ?? '—',
          dueAt: a.homework?.dueAt ?? null,
          status: a.status,
          grade: a.grade ?? null,
          href: `/homework/${a.id}`,
        })))
      })
      .catch(() => {})
      .finally(() => setHwLoading(false))
  }, [view, studentId, homeworks.length])

  const correctionRate =
    data && data.totalErrors > 0
      ? Math.round((data.totalCorrected / data.totalErrors) * 100)
      : 0

  const reportDate = new Date().toLocaleDateString(t.dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const handlePrint = () => {
    const studentName = data?.student?.name?.replace(/\s+/g, '_') ?? 'report'
    const prev = document.title
    document.title = `${lang.toUpperCase()}-${studentName}`
    window.print()
    setTimeout(() => { document.title = prev }, 1000)
  }

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loadingState}>{t.loading}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.errorState}>{error}</div>
      </div>
    )
  }

  if (!data) return null

  const hwStatusLabels = HW_STATUS_LABELS[lang]

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.langTabs}>
          <button
            className={`${styles.langTab} ${view === 'report' ? styles.langTabActive : ''}`}
            onClick={() => setView('report')}
            type="button"
          >
            {lang === 'ru' ? 'Отчёт' : lang === 'zh' ? '报告' : lang === 'hi' ? 'रिपोर्ट' : 'Report'}
          </button>
          <button
            className={`${styles.langTab} ${view === 'homework' ? styles.langTabActive : ''}`}
            onClick={() => setView('homework')}
            type="button"
          >
            {lang === 'ru' ? 'ДЗ' : lang === 'zh' ? '作业' : lang === 'hi' ? 'गृहकार्य' : 'HW'}
          </button>
        </div>
        {view === 'report' && (
          <>
            <div className={styles.langTabs}>
              {(['ru', 'en', 'zh', 'hi'] as const).map(l => (
                <button
                  key={l}
                  className={`${styles.langTab} ${lang === l ? styles.langTabActive : ''}`}
                  onClick={() => setLang(l)}
                  type="button"
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button className={styles.printBtn} onClick={handlePrint} type="button">
              <DownloadIcon />
              {t.download}
            </button>
          </>
        )}
      </div>

      {view === 'homework' && (
        <div className={styles.report} style={{ padding: 24 }}>
          {hwLoading && <div className={styles.loadingState}>{t.loading}</div>}
          {!hwLoading && homeworks.length === 0 && (
            <div className={styles.loadingState}>
              {lang === 'ru' ? 'Домашних заданий нет' : lang === 'zh' ? '没有作业' : lang === 'hi' ? 'कोई गृहकार्य नहीं' : 'No homework assignments'}
            </div>
          )}
          {homeworks.map(hw => {
            const isDone = hw.status === 'REVIEWED'
            const overdue = hw.dueAt && new Date(hw.dueAt) < new Date() && !isDone
            return (
              <Link
                key={hw.id}
                href={hw.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  padding: '12px 16px',
                  marginBottom: 8,
                  background: isDone ? 'linear-gradient(135deg,#fafafe,#f5f3ff)' : '#fff',
                  border: `1.5px solid ${isDone ? '#c4b5fd' : '#e8e8f0'}`,
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#141416', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>
                    {hw.title}
                  </p>
                  {hw.dueAt && (
                    <span style={{ fontSize: 12, color: overdue ? '#ef4444' : '#94a3b8' }}>
                      {lang === 'ru' ? 'Срок' : 'Due'}: {new Date(hw.dueAt).toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'short' })}
                      {overdue ? (lang === 'ru' ? ' · просрочено' : ' · overdue') : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {hw.grade !== null && (
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#6366f1' }}>{hw.grade}/10</span>
                  )}
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: HW_STATUS_COLORS[hw.status] + '22',
                    color: HW_STATUS_COLORS[hw.status],
                  }}>
                    {hwStatusLabels[hw.status] ?? hw.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {view === 'report' && (
      <div className={styles.report}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.reportTitle}>{t.title}</div>
            <div className={styles.studentName}>{data.student?.name ?? '—'}</div>
            <div className={styles.meta}>{data.student?.email}</div>
          </div>
          <div className={styles.metaBlock}>
            <div className={styles.meta}>{t.teacher}: <strong>{data.teacher?.name ?? '—'}</strong></div>
            <div className={styles.meta}>{t.date}: {reportDate}</div>
            <div className={styles.period}>{t.period}</div>
          </div>
        </div>

        {/* Stat cards */}
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.totalErrors}</div>
            <div className={styles.cardLabel}>{t.errors}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.totalCorrected}</div>
            <div className={styles.cardLabel}>{t.corrected}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{correctionRate}%</div>
            <div className={styles.cardLabel}>{t.corrRate}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.avgScore != null ? `${data.avgScore}%` : '—'}</div>
            <div className={styles.cardLabel}>{t.avgScore}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.totalCalls}</div>
            <div className={styles.cardLabel}>{t.calls}</div>
          </div>
        </div>

        {/* Charts */}
        <div className={styles.charts}>
          {/* Errors over time */}
          <div className={styles.chartBlock}>
            <div className={styles.chartTitle}>{t.errWeekly}</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.errorsOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: ch.tick }} />
                <YAxis tick={{ fontSize: 11, fill: ch.tick }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: `1px solid ${ch.tooltipBdr}`, fontSize: 12, background: ch.tooltipBg, color: ch.tooltipLbl }}
                  labelStyle={{ color: ch.tooltipLbl, fontWeight: 600 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={ch.line1}
                  strokeWidth={2}
                  dot={{ fill: ch.line1, r: 3 }}
                  activeDot={{ r: 5 }}
                  name={t.errLine}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Avg test scores over time */}
          <div className={styles.chartBlock}>
            <div className={styles.chartTitle}>{t.scoreWeekly}</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.attemptsOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: ch.tick }} />
                <YAxis tick={{ fontSize: 11, fill: ch.tick }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: `1px solid ${ch.tooltipBdr}`, fontSize: 12, background: ch.tooltipBg, color: ch.tooltipLbl }}
                  labelStyle={{ color: ch.tooltipLbl, fontWeight: 600 }}
                  formatter={(value) => value != null ? `${value}%` : '—'}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke={ch.line2}
                  strokeWidth={2}
                  dot={{ fill: ch.line2, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  name={t.scoreLine}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top error categories */}
          {data.errorsByCategory.length > 0 && (
            <div className={styles.chartBlock}>
              <div className={styles.chartTitle}>{t.topErrors}</div>
              <ResponsiveContainer width="100%" height={Math.max(200, data.errorsByCategory.length * 36)}>
                <BarChart
                  layout="vertical"
                  data={data.errorsByCategory}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: ch.tick }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11, fill: ch.tickDark }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: `1px solid ${ch.tooltipBdr}`, fontSize: 12, background: ch.tooltipBg, color: ch.tooltipLbl }}
                    labelStyle={{ color: ch.tooltipLbl, fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill={ch.bar} radius={[0, 4, 4, 0]} name={t.errLine} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
