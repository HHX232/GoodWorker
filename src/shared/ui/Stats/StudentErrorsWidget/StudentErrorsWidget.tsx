'use client'

import styles from './StudentErrorsWidget.module.scss'

export interface ErrorStat {
  categoryId: string
  name: string
  count: number
  color: string
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export function StudentErrorsWidget({
  extraClass,
  data,
}: {
  extraClass?: string
  data?: ErrorStat[]
}) {
  const items = (data ?? []).slice(0, 8)
  const max = items.length > 0 ? Math.max(...items.map(e => e.count)) : 1

  return (
    <div className={`${styles.card} ${extraClass ?? ''}`}>
      <div className={styles.header}>
        <p className={styles.title}>Ошибки учеников</p>
        {items.length > 0 && (
          <span className={styles.badge}>{items.reduce((s, e) => s + e.count, 0)} всего</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><IconAlert /></div>
          <span>Ошибки ещё не зафиксированы</span>
        </div>
      ) : (
        <div className={`${styles.list} ${styles.list_hoverable}`}>
          {items.map((item, i) => (
            <div
              key={item.categoryId}
              className={styles.item}
              style={{ opacity: 1 - i * 0.08 }}
            >
              <div className={styles.item_top}>
                <div className={styles.item_name}>
                  <span className={styles.dot} style={{ background: item.color }} />
                  <span className={styles.item_label}>{item.name}</span>
                </div>
                <span className={styles.item_count}>{item.count}</span>
              </div>
              <div className={styles.bar_track}>
                <div
                  className={styles.bar_fill}
                  style={{ width: `${(item.count / max) * 100}%`, background: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
