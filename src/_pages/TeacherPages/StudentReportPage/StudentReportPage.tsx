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

  const reportDate = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loadingState}>Загрузка отчёта...</div>
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
      <button className={styles.printBtn} onClick={() => window.print()}>
        <DownloadIcon />
        Скачать PDF
      </button>

      <div className={styles.report}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.reportTitle}>Отчёт об успеваемости</div>
            <div className={styles.studentName}>{data.student?.name ?? '—'}</div>
            <div className={styles.meta}>{data.student?.email}</div>
          </div>
          <div className={styles.metaBlock}>
            <div className={styles.meta}>Преподаватель: <strong>{data.teacher?.name ?? '—'}</strong></div>
            <div className={styles.meta}>Дата: {reportDate}</div>
            <div className={styles.period}>Период: последние 12 недель</div>
          </div>
        </div>

        {/* Stat cards */}
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.totalErrors}</div>
            <div className={styles.cardLabel}>Ошибок совершено</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.totalCorrected}</div>
            <div className={styles.cardLabel}>Ошибок исправлено</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{correctionRate}%</div>
            <div className={styles.cardLabel}>Процент исправления</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.avgScore != null ? `${data.avgScore}%` : '—'}</div>
            <div className={styles.cardLabel}>Средний балл тестов</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardValue}>{data.totalCalls}</div>
            <div className={styles.cardLabel}>Занятий проведено</div>
          </div>
        </div>

        {/* Charts */}
        <div className={styles.charts}>
          {/* Errors over time */}
          <div className={styles.chartBlock}>
            <div className={styles.chartTitle}>Ошибки по неделям</div>
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
                  name="Ошибок"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Avg test scores over time */}
          <div className={styles.chartBlock}>
            <div className={styles.chartTitle}>Средний балл тестов по неделям</div>
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
                  name="Средний балл"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top error categories */}
          {data.errorsByCategory.length > 0 && (
            <div className={styles.chartBlock}>
              <div className={styles.chartTitle}>Топ категорий ошибок</div>
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
                  <Bar dataKey="count" fill="#333" radius={[0, 4, 4, 0]} name="Ошибок" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
