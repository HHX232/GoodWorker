'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './HomeworkListPage.module.scss'

interface HWItem {
  id: string
  title: string
  dueAt: string | null
  sendAt: string | null
  href: string
  status: string
  grade: number | null
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Не начато',
  IN_PROGRESS: 'В процессе',
  SUBMITTED: 'Сдано',
  REVIEWED: 'Проверено',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#94a3b8',
  IN_PROGRESS: '#f59e0b',
  SUBMITTED: '#10b981',
  REVIEWED: '#6366f1',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function isOverdue(iso: string, status: string) {
  return new Date(iso) < new Date() && status !== 'SUBMITTED' && status !== 'REVIEWED'
}

function HWCard({ item }: { item: HWItem }) {
  const overdue = item.dueAt ? isOverdue(item.dueAt, item.status) : false
  const isDone = item.status === 'REVIEWED'

  return (
    <Link href={item.href} className={`${styles.card} ${isDone ? styles.cardReviewed : ''}`}>
      <div className={styles.cardLeft}>
        <div className={`${styles.cardIcon} ${isDone ? styles.cardIconDone : ''}`}>
          {isDone ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
            </svg>
          )}
        </div>
        <div className={styles.cardBody}>
          <p className={styles.cardTitle}>{item.title}</p>
          {item.dueAt && (
            <span className={`${styles.cardDue} ${overdue ? styles.cardDueOverdue : ''}`}>
              Срок: {formatDate(item.dueAt)}{overdue ? ' · просрочено' : ''}
            </span>
          )}
        </div>
      </div>
      <div className={styles.cardRight}>
        {item.grade !== null && item.grade !== undefined && (
          <span className={styles.cardGrade}>{item.grade}/10</span>
        )}
        <span
          className={styles.cardStatus}
          style={{ background: STATUS_COLORS[item.status] + '22', color: STATUS_COLORS[item.status] }}
        >
          {STATUS_LABELS[item.status] ?? item.status}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: '#cbd5e1', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </Link>
  )
}

export default function HomeworkListPage() {
  const [items, setItems] = useState<HWItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/homework/mine')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.homeworks ?? [])
        setItems(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const active = items.filter(i => i.status !== 'REVIEWED')
  const reviewed = items.filter(i => i.status === 'REVIEWED')

  if (loading) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    )
  }

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.pageTitle}>Мои домашние задания</h1>

      {items.length === 0 && (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>Домашних заданий пока нет</p>
        </div>
      )}

      {active.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Активные</h2>
          <div className={styles.list}>
            {active.map(item => <HWCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.sectionTitleDone}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Проверено учителем
          </h2>
          <div className={styles.list}>
            {reviewed.map(item => <HWCard key={item.id} item={item} />)}
          </div>
        </section>
      )}
    </div>
  )
}
