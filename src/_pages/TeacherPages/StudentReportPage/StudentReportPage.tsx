'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
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
      </div>

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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 12 }}
                  labelStyle={{ color: '#111118', fontWeight: 600 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#111118"
                  strokeWidth={2}
                  dot={{ fill: '#111118', r: 3 }}
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 12 }}
                  labelStyle={{ color: '#111118', fontWeight: 600 }}
                  formatter={(value) => value != null ? `${value}%` : '—'}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#555"
                  strokeWidth={2}
                  dot={{ fill: '#555', r: 3 }}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11, fill: '#555' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 12 }}
                    labelStyle={{ color: '#111118', fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill="#333" radius={[0, 4, 4, 0]} name={t.errLine} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
