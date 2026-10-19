import { Crown, Gem, Globe, Lock, Zap } from 'lucide-react'
import { Flame } from './Flame'
import type { BadgeGroup } from './badges'
import styles from './Progress.module.scss'

const ICON = { bot: Crown, points: Gem, storm: Zap, online: Globe } as const

/** Медаль значка: иконка группы и число порога; закрытая — пунктир и замок. */
export function BadgeMedal({ group, n, earned, size = 56 }: { group: BadgeGroup; n: number; earned: boolean; size?: number }) {
  const Icon = group === 'streak' ? null : ICON[group]
  return (
    <span className={styles.medal} data-group={group} data-earned={earned || undefined} style={{ ['--medal' as string]: `${size}px` }} aria-hidden="true">
      {Icon ? <Icon size={size * 0.4} strokeWidth={1.75} /> : <Flame state={earned ? 'today' : 'broken'} size={size * 0.44} />}
      {group !== 'online' && <span className={styles.medalNum}>{n}</span>}
      {!earned && (
        <span className={styles.medalLock}>
          <Lock size={11} strokeWidth={2.25} />
        </span>
      )}
    </span>
  )
}
