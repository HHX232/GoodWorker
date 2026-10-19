import styles from './Progress.module.scss'

/** Рейтинг: подпись, крупное число, подстрочник (сколько партий/задач). */
export function RatingChip({ label, value, sub, className }: { label: string; value: number; sub?: string; className?: string }) {
  return (
    <div className={`${styles.chip} ${className ?? ''}`}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={styles.chipValue}>{value}</span>
      {sub && <span className={styles.chipSub}>{sub}</span>}
    </div>
  )
}
