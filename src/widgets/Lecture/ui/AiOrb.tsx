'use client'

import type { CSSProperties } from 'react'
import styles from './AiOrb.module.scss'

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'finalizing' | 'offline' | 'error'

/**
 * The left-column "AI is here" dot: a core with rings rippling out of it.
 * listening — rings follow the mic level; thinking — faster violet pulses
 * (DeepSeek is writing); finalizing — slow wide waves (big-model pass);
 * offline — amber, chunks are waiting in the local queue.
 */
export function AiOrb({ mode, level = 0, size = 168, label }: { mode: OrbMode; level?: number; size?: number; label?: string }) {
  const style = { '--orb-size': `${size}px`, '--orb-level': Math.min(1, Math.max(0, level)).toFixed(3) } as CSSProperties
  return (
    <div className={`${styles.orb} ${styles[mode]}`} style={style} role="img" aria-label={label}>
      <span className={styles.ring} />
      <span className={styles.ring} />
      <span className={styles.ring} />
      <span className={styles.halo} />
      <span className={styles.core} />
    </div>
  )
}
