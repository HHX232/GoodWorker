'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from './HomeworkTab.module.scss'

interface AssignmentInfo {
  id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVIEWED'
  completedBlocks: number
  totalBlocks: number
  createdAt: string
  homework: {
    id: string
    title: string
    dueAt: string | null
    createdAt: string
    teacher: { id: string; name: string }
  }
}

interface Props {
  studentId: string
  teacherId?: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isDueOverdue(iso: string) {
  return new Date(iso) < new Date()
}

export function HomeworkTab({ studentId, teacherId }: Props) {
  const t = useTranslations('homework')
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/homework/student?studentId=${studentId}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.assignments)) setAssignments(d.assignments) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId])

  const statusClass: Record<string, string> = {
    PENDING: styles.statusPending,
    IN_PROGRESS: styles.statusInProgress,
    SUBMITTED: styles.statusSubmitted,
    REVIEWED: styles.statusReviewed,
  }
  const statusLabel: Record<string, string> = {
    PENDING: t('statusPending'),
    IN_PROGRESS: t('statusInProgress'),
    SUBMITTED: t('statusSubmitted'),
    REVIEWED: t('statusReviewed'),
  }

  return (
    <div className={styles.wrap}>
      {teacherId && (
        <Link
          href={`/homework/create?studentId=${studentId}`}
          className={styles.assignBtn}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('assignBtn')}
        </Link>
      )}

      {loading && <div className={styles.loading}>…</div>}

      {!loading && assignments.length === 0 && (
        <div className={styles.empty}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>{t('empty')}</span>
        </div>
      )}

      {!loading && assignments.length > 0 && (
        <div className={styles.list}>
          {assignments.map((a) => {
            const pct = a.totalBlocks > 0 ? Math.round((a.completedBlocks / a.totalBlocks) * 100) : 0
            return (
              <div key={a.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={`${styles.statusBadge} ${statusClass[a.status] ?? ''}`}>
                    {statusLabel[a.status] ?? a.status}
                  </span>
                  {a.homework.dueAt && (
                    <span className={`${styles.dueTag} ${isDueOverdue(a.homework.dueAt) && a.status !== 'SUBMITTED' ? styles.dueOverdue : ''}`}>
                      {t('dueLabel')}: {formatDate(a.homework.dueAt)}
                    </span>
                  )}
                </div>

                <div className={styles.cardTitle}>{a.homework.title}</div>

                <div className={styles.progressRow}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressText}>
                    {t('blocksProgress', { done: a.completedBlocks, total: a.totalBlocks })}
                  </span>
                </div>

                <div className={styles.cardBottom}>
                  <span className={styles.cardDate}>{formatDate(a.homework.createdAt)}</span>
                  <Link href={`/homework/${a.id}`} className={styles.viewBtn}>
                    {t('viewBtn')}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
