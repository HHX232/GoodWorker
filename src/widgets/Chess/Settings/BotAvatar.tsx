'use client'

import { useId, type CSSProperties } from 'react'
import type { BotLook } from '@/shared/lib/chess/data'
import styles from './BotAvatar.module.scss'

// Bots are chess pieces with faces, drawn in the coach's line (CoachAvatar): ivory hide, ink outline, coloured collar.
// Head silhouettes; each sits with its face around y≈32.
const HEAD: Record<BotLook['piece'], string> = {
  p: 'M32 15a12.5 12.5 0 1 1 0 25a12.5 12.5 0 1 1 0-25z',
  b: 'M32 9c7.4 5.6 12.6 13 12.6 21.4 0 7.8-5.6 12.6-12.6 12.6S19.4 38.2 19.4 30.4C19.4 22 24.6 14.6 32 9z',
  r: 'M18.6 14.4h5.6v4.4h4.8v-4.4h6v4.4h4.8v-4.4h5.6v15c0 8.6-5.6 13.8-13.4 13.8s-13.4-5.2-13.4-13.8z',
  q: 'M32 19.4a12.4 12.4 0 1 1 0 24.8a12.4 12.4 0 1 1 0-24.8z',
  k: 'M32 19.4a12.4 12.4 0 1 1 0 24.8a12.4 12.4 0 1 1 0-24.8z',
}
const EYES_Y: Record<BotLook['piece'], number> = { p: 26.6, b: 29, r: 28, q: 31, k: 31 }

export function BotAvatar({ look, size = 44, className }: { look: BotLook; size?: number; className?: string }) {
  const clip = useId()
  const ey = EYES_Y[look.piece]
  const dark = look.badge.startsWith('#1') || look.badge.startsWith('#2') // night-coloured badges
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`${styles.avatar} ${className ?? ''}`}
      style={{ '--badge': look.badge, '--accent': look.accent } as CSSProperties}
      data-dark={dark || undefined}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" className={styles.badge} />
      <g clipPath={`url(#${clip})`}>
        {/* collar and shoulders: the piece's base */}
        <path className={styles.body} d="M12 66c0-10.4 8.4-17.4 20-17.4S52 55.6 52 66z" />
        <path className={styles.collar} d="M19.6 52.4c7.6 3.6 17.2 3.6 24.8 0l1.8 4.4c-8.8 4.4-19.6 4.4-28.4 0z" />
        {look.piece === 'q' && <path className={styles.crown} d="M20.4 23.6l-1.8-11 6.8 6 6.6-9.4 6.6 9.4 6.8-6-1.8 11z" />}
        {look.piece === 'k' && <path className={styles.crown} d="M29.6 4.6h4.8v4.6h4.6V14h-4.6v6h-4.8v-6H25V9.2h4.6z" />}
        <path className={styles.head} d={HEAD[look.piece]} />
        {look.piece === 'b' && <path className={styles.line} d="M36.4 14.6l-5.4 7.4" />}
        {look.piece === 'r' && <path className={styles.line} d="M20.4 22.4h23.2" />}
        <circle className={styles.eye} cx="27.4" cy={ey} r="1.8" />
        <circle className={styles.eye} cx="36.6" cy={ey} r="1.8" />
        <path className={styles.line} d={`M28.4 ${ey + 6}c2.4 1.9 4.8 1.9 7.2 0`} />
        {look.extra === 'glasses' && (
          <g className={styles.wire}>
            <circle cx="27.4" cy={ey} r="4.2" />
            <circle cx="36.6" cy={ey} r="4.2" />
            <path d={`M31.6 ${ey}h0.8`} />
          </g>
        )}
        {look.extra === 'monocle' && (
          <g className={styles.wire}>
            <circle cx="36.6" cy={ey} r="4.4" />
            <path d={`M40.6 ${ey + 2}c2 4 1.6 9-0.6 13`} />
          </g>
        )}
        {look.extra === 'beard' && <path className={styles.beard} d={`M24 ${ey + 3}c1 9 4.4 13.6 8 13.6s7-4.6 8-13.6c-2.6 2.6-5.2 3.4-8 3.4s-5.4-.8-8-3.4z`} />}
        {look.extra === 'headband' && <path className={styles.band} d={`M19.6 ${ey - 6.4}c8-3 16.8-3 24.8 0l-.6 3.6c-7.8-2.6-15.8-2.6-23.6 0z`} />}
        {look.extra === 'cap' && <path className={styles.band} d={`M19.8 ${ey - 3.6}c.4-7.6 5.6-12 12.2-12s11.8 4.4 12.2 12c-3.8-1.6-8-2.4-12.2-2.4s-8.4.8-12.2 2.4zM43.4 ${ey - 4.4}l6.8 1.6-1 2.4-6-1.2z`} />}
        {look.extra === 'bow' && <path className={styles.band} d={`M38.4 ${ey - 10.6}l-4.8-3v6zM38.4 ${ey - 10.6}l4.8-3v6z`} />}
      </g>
    </svg>
  )
}
