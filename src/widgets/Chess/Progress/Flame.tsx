import { useId } from 'react'
import styles from './Progress.module.scss'

export type FlameState = 'today' | 'threat' | 'broken'

/** Пламя огонька серии: внешний язык и светлое ядро. Цвет и «тусклость» — по data-state из Progress.module.scss. */
export function Flame({ state, size = 24, className }: { state: FlameState; size?: number; className?: string }) {
  const g = useId()
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`${styles.flame} ${className ?? ''}`} data-state={state} aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--flame-base)" />
          <stop offset="1" stopColor="var(--flame-tip)" />
        </linearGradient>
      </defs>
      <path
        data-part="outer"
        fill={`url(#${g})`}
        d="M12 1.8c.7 3.3 2.7 5.2 4.6 7.1 1.9 2 3.2 4.2 3.2 6.9 0 4.4-3.5 7.8-7.8 7.8S4.2 20.2 4.2 15.8c0-2.7 1.2-4.8 3-6.6.2 1.9 1 3.2 2.4 3.8-.4-4.6.4-8.4 2.4-11.2z"
      />
      <path
        data-part="core"
        d="M12.3 11.6c1.8 1.7 3.5 3.2 3.5 5.4a3.7 3.7 0 0 1-7.4 0c0-1.4.6-2.4 1.6-3.3.2 1 .7 1.5 1.4 1.7-.1-1.4.2-2.7.9-3.8z"
      />
    </svg>
  )
}
