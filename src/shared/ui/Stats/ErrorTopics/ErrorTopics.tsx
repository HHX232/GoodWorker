'use client'
import styles from './ErrorTopics.module.scss'

interface ErrorTopic {
  topic: string
  subject: string
  count: number
}

const mockErrors: ErrorTopic[] = [
  {topic: 'Жи-ши, ча-ща', subject: 'Русский', count: 8},
  {topic: 'Деепричастие', subject: 'Русский', count: 6},
  {topic: 'Квадр. уравнения', subject: 'Математика', count: 5},
  {topic: 'Показат. функции', subject: 'Математика', count: 3},
  {topic: 'Окисление', subject: 'Химия', count: 2}
]

const MAX = Math.max(...mockErrors.map((e) => e.count))
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

export function ErrorTopics({extraClass}: {extraClass?: string}) {
  return (
    <div className={`${styles.card} ${extraClass}`}>
      <div className={styles.header}>
        <p className={styles.title}>Частые ошибки</p>
        <span className={styles.period}>этот месяц</span>
      </div>

      <div className={`${styles.list} ${styles.list_hoverable}`}>
        {mockErrors.map((item, i) => (
          <div
            key={item.topic}
            className={styles.item}
            style={{opacity: 1 - i * 0.15}}
            onClick={() => {
              console.log('[ErrorTopics] clicked:', item)
            }}
          >
            <div className={styles.item__top}>
              <span className={styles.item__topic}>{item.topic}</span>
              <div className={styles.item__right}>
                <span className={styles.item__count}>{item.count} уч.</span>
                <span className={styles.arrow}>↗</span>
              </div>
            </div>
            <div className={styles.bar_track}>
              <div className={styles.bar_fill} style={{width: `${(item.count / MAX) * 100}%`}} />
            </div>
            <div className={styles.item__bottom}>
              <span className={styles.item__subject}>{item.subject}</span>
              <StreakDots count={item.count} max={MAX} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
