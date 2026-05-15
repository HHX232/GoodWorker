'use client'
import {useTranslations} from 'next-intl'
import styles from './ErrorTopics.module.scss'

export interface TopicSubject {
  name: string
  hours: number
  count: number
  color: string
}

const DOTS = 5

function StreakDots({count, max}: {count: number; max: number}) {
  const lit = Math.round((count / max) * DOTS)
  return (
    <div className={styles.streak}>
      {Array.from({length: DOTS}, (_, i) => (
        <span key={i} className={`${styles.dot} ${i < lit ? styles.dot_lit : ''}`} />
      ))}
    </div>
  )
}

export function ErrorTopics({
  extraClass,
  subjects,
  onSubjectClick,
}: {
  extraClass?: string
  subjects?: TopicSubject[]
  onSubjectClick?: (subject: TopicSubject) => void
}) {
  const t = useTranslations('statsPage.topSubjects')
  const items = (subjects ?? []).slice(0, 5)
  const max = items.length > 0 ? Math.max(...items.map((s) => s.count)) : 1

  if (items.length === 0) {
    return (
      <div className={`${styles.card} ${extraClass ?? ''}`}>
        <div className={styles.header}>
          <p className={styles.title}>{t('title')}</p>
        </div>
        <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <p style={{fontSize: 13, color: '#bbb', textAlign: 'center'}}>{t('noData')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.card} ${extraClass ?? ''}`}>
      <div className={styles.header}>
        <p className={styles.title}>{t('title')}</p>
        <span className={styles.period}>{t('period')}</span>
      </div>

      <div className={`${styles.list} ${styles.list_hoverable}`}>
        {items.map((item, i) => (
          <div
            key={item.name}
            className={styles.item}
            style={{opacity: 1 - i * 0.1, cursor: onSubjectClick ? 'pointer' : 'default'}}
            onClick={() => onSubjectClick?.(item)}
          >
            <div className={styles.item__top}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <span style={{width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0, display: 'inline-block'}} />
                <span className={styles.item__topic}>{item.name}</span>
              </div>
              <div className={styles.item__right}>
                <span className={styles.item__count}>{item.count} {t('lessons')}</span>
                {onSubjectClick && <span className={styles.arrow}>↗</span>}
              </div>
            </div>
            <div className={styles.bar_track}>
              <div className={styles.bar_fill} style={{width: `${(item.count / max) * 100}%`, background: item.color}} />
            </div>
            <div className={styles.item__bottom}>
              <span className={styles.item__subject}>{item.hours} {t('hours')}</span>
              <StreakDots count={item.count} max={max} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
