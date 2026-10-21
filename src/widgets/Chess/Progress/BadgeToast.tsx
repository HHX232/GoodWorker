import Link from 'next/link'
import { Gift, X } from 'lucide-react'
import { BadgeMedal } from './BadgeMedal'
import { badgeText } from './badges'
import styles from './Progress.module.scss'

/** Тост «Новый значок!» (sonner toast.custom); `rewards` — что открылось (фигуры, доска, дни VIP). Строки приходят готовыми — тост живёт вне дерева страницы. */
export function BadgeToast(p: { code: string; title: string; name: string; hint: string; more: string | null; rewards?: string[]; openLabel: string; closeLabel: string; onClose: () => void }) {
  const { group, values } = badgeText(p.code)
  return (
    <div className={styles.toast} role="status">
      <span className={styles.toastMedal}>
        <BadgeMedal group={group} n={values.n} earned size={52} />
      </span>
      <div className={styles.toastText}>
        <strong>{p.title}</strong>
        <span className={styles.toastName}>
          {p.name}
          {p.more && <span className={styles.toastMore}> · {p.more}</span>}
        </span>
        <span className={styles.toastHint}>{p.hint}</span>
        {p.rewards?.map((r) => (
          <span key={r} className={styles.toastReward}>
            <Gift size={14} strokeWidth={2} aria-hidden="true" />
            {r}
          </span>
        ))}
        <Link href="/chess/profile" className={styles.toastLink} onClick={p.onClose}>
          {p.openLabel}
        </Link>
      </div>
      <button type="button" className={styles.toastClose} onClick={p.onClose} aria-label={p.closeLabel}>
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
