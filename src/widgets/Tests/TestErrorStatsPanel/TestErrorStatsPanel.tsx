'use client'

import { useEffect, useState } from 'react'
import styles from './TestErrorStatsPanel.module.scss'

interface CategoryStat {
  id: string
  name: string
  count: number
}

interface StudentError {
  description: string | null
  fragment: string | null
  categories: { id: string; name: string }[]
  createdAt: string
}

interface StudentStat {
  student: { id: string; name: string; avatarUrl: string | null }
  attemptCount: number
  avgPercent: number
  errors: StudentError[]
}

interface StatsData {
  testTitle: string
  totalAttempts: number
  topCategories: CategoryStat[]
  byStudent: StudentStat[]
}

function PercentBadge({ value }: { value: number }) {
  const cls = value >= 75 ? styles.percentGood : value >= 50 ? styles.percentMid : styles.percentBad
  return <span className={`${styles.percentBadge} ${cls}`}>{value}%</span>
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <div className={styles.avatar}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} />
      </div>
    )
  }
  return <div className={styles.avatar}>{name[0]?.toUpperCase()}</div>
}

function StudentRow({ s }: { s: StudentStat }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.studentItem}>
      <div className={styles.studentHeader} onClick={() => setOpen(v => !v)}>
        <div className={styles.studentInfo}>
          <Avatar name={s.student.name} url={s.student.avatarUrl} />
          <span className={styles.studentName}>{s.student.name}</span>
        </div>
        <div className={styles.studentMeta}>
          <span className={styles.attemptCount}>{s.attemptCount} {s.attemptCount === 1 ? 'попытка' : 'попыток'}</span>
          <PercentBadge value={s.avgPercent} />
          <svg
            width="14" height="14" viewBox="0 0 12 12" fill="none"
            className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
          >
            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      {open && (
        <div className={styles.studentErrors}>
          {s.errors.length === 0 ? (
            <div className={styles.empty}>Ошибок нет</div>
          ) : (
            s.errors.map((e, i) => (
              <div key={i} className={styles.errRow}>
                {e.description && <div className={styles.errDesc}>{e.description}</div>}
                {e.fragment && <div className={styles.errFragment}>«{e.fragment}»</div>}
                {e.categories.length > 0 && (
                  <div className={styles.errCats}>
                    {e.categories.map(c => (
                      <span key={c.id} className={styles.catChip}>{c.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function TestErrorStatsPanel({ testId }: { testId: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || data) return
    setLoading(true)
    fetch(`/api/tests/${testId}/error-stats`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, testId, data])

  const maxCatCount = data?.topCategories[0]?.count ?? 1

  return (
    <div className={styles.panel}>
      <div className={styles.header} onClick={() => setOpen(v => !v)}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div className={styles.headerTitle}>Статистика ошибок</div>
            {data && (
              <div className={styles.headerSub}>
                {data.totalAttempts} попыток · {data.byStudent.length} учеников
              </div>
            )}
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 12 12" fill="none"
          className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {open && (
        <div className={styles.body}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : !data ? (
            <div className={styles.empty}>Нет данных</div>
          ) : (
            <>
              {/* Top categories */}
              {data.topCategories.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Частые темы ошибок</div>
                  <div className={styles.catList}>
                    {data.topCategories.map((c, i) => (
                      <div key={c.id} className={styles.catItem}>
                        <span className={styles.catRank}>#{i + 1}</span>
                        <div className={styles.catBar}>
                          <div className={styles.catName}>{c.name}</div>
                          <div className={styles.catTrack}>
                            <div
                              className={styles.catFill}
                              style={{ width: `${(c.count / maxCatCount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className={styles.catCount}>{c.count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-student */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>По ученикам</div>
                {data.byStudent.length === 0 ? (
                  <div className={styles.empty}>Попыток пока нет</div>
                ) : (
                  <div className={styles.studentList}>
                    {data.byStudent.map(s => (
                      <StudentRow key={s.student.id} s={s} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
