'use client'

import { useEffect, useState } from 'react'
import styles from './StudentErrorsList.module.scss'

type Sort = 'time' | 'freq'

interface ErrorCategory {
  id: string
  name: string
}

interface ErrorItem {
  id: string
  createdAt: string
  description: string | null
  fragment: string | null
  categories: ErrorCategory[]
}

interface FreqItem {
  id: string
  name: string
  count: number
  lastSeen: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function IconAlertCircle() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

export function StudentErrorsList() {
  const [sort, setSort] = useState<Sort>('time')
  const [timeErrors, setTimeErrors] = useState<ErrorItem[]>([])
  const [freqErrors, setFreqErrors] = useState<FreqItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/student/errors?sort=${sort}`)
      .then(r => r.json())
      .then(data => {
        if (sort === 'time') setTimeErrors(data.errors ?? [])
        else setFreqErrors(data.categories ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sort])

  const maxCount = freqErrors.length > 0 ? freqErrors[0].count : 1

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Мои ошибки</h3>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${sort === 'time' ? styles.toggleActive : ''}`}
            onClick={() => setSort('time')}
          >
            По времени
          </button>
          <button
            className={`${styles.toggleBtn} ${sort === 'freq' ? styles.toggleActive : ''}`}
            onClick={() => setSort('freq')}
          >
            Частые
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.empty}>
            <span>Загрузка...</span>
          </div>
        ) : sort === 'time' ? (
          timeErrors.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><IconAlertCircle /></div>
              <span>Ошибок пока нет</span>
            </div>
          ) : (
            timeErrors.map(e => (
              <div key={e.id} className={styles.errorItem}>
                <div className={styles.errorMeta}>
                  <span className={styles.errorDate}>{fmtDate(e.createdAt)}</span>
                  {e.categories.map(c => (
                    <span key={c.id} className={styles.catChip}>{c.name}</span>
                  ))}
                </div>
                {e.description && (
                  <div className={styles.errorDesc}>{e.description}</div>
                )}
                {e.fragment && (
                  <div className={styles.errorFragment}>«{e.fragment}»</div>
                )}
              </div>
            ))
          )
        ) : (
          freqErrors.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><IconAlertCircle /></div>
              <span>Ошибок пока нет</span>
            </div>
          ) : (
            freqErrors.map((item, i) => (
              <div key={item.id} className={styles.freqItem}>
                <div className={styles.freqLeft}>
                  <span className={styles.freqRank}>#{i + 1}</span>
                  <div className={styles.freqBar}>
                    <div className={styles.freqName}>{item.name}</div>
                    <div className={styles.freqTrack}>
                      <div
                        className={styles.freqFill}
                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className={styles.freqLast}>{fmtDate(item.lastSeen)}</span>
                <span className={styles.freqCount}>{item.count}×</span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
