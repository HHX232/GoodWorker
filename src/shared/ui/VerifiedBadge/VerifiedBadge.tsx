'use client'

import styles from './VerifiedBadge.module.scss'

interface Props {
  tooltip: string
  size?: number
}

export function VerifiedBadge({ tooltip, size = 15 }: Props) {
  return (
    <span className={styles.wrap} aria-label={tooltip}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={styles.icon}
      >
        <path
          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-.702 3.637 3.745 3.745 0 0 1-3.637.702A3.746 3.746 0 0 1 12 21a3.746 3.746 0 0 1-3.068-1.593 3.745 3.745 0 0 1-3.637-.702 3.745 3.745 0 0 1-.702-3.637A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 .702-3.637 3.745 3.745 0 0 1 3.637-.702A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 0 1 3.637.702 3.745 3.745 0 0 1 .702 3.637A3.746 3.746 0 0 1 21 12Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.tooltip}>{tooltip}</span>
    </span>
  )
}
