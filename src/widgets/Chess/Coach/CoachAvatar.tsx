'use client'

import { useId, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import styles from './CoachAvatar.module.scss'

export type CoachMood = 'idle' | 'thinking' | 'concerned'

// GoodWorker's coach: a knight in wire spectacles and a green scarf, in profile, facing its own words.
const BROW: Record<CoachMood, string> = {
  idle: 'M34.5 18.6c2.4-1.3 5.4-1.4 8-.2',
  thinking: 'M34.5 16.4c2.6-2 5.8-2.2 8.4-.5',
  concerned: 'M34.5 19.4c2.8-.4 5.6-1.4 8-3.2',
}
const PUPIL: Record<CoachMood, [number, number]> = { idle: [39.4, 25.6], thinking: [40, 23.6], concerned: [39, 26.2] }

export function CoachAvatar({ mood = 'idle', size = 44, className }: { mood?: CoachMood; size?: number; className?: string }) {
  const clip = useId()
  const [px, py] = PUPIL[mood]
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`${styles.avatar} ${className ?? ''}`} data-mood={mood} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" className={styles.badge} />
      <g clipPath={`url(#${clip})`}>
        {/* far ear and mane behind the head */}
        <path className={styles.mane} d="M29 16.5l2.8-9.6 4.6 9.4z" />
        <path
          className={styles.mane}
          d="M23.4 19.5l-5.6 5.2 2.6 1.4-5.6 6.6 3 1-4.6 8 3 .9-3.8 9.2 2.6.9L12 66h8.4c-1.6-15.6-.4-30.4 4.6-42.8z"
        />
        <path
          className={styles.head}
          d="M18.4 66c-1.2-15 .2-29.6 4.4-41.4l1.4-16 6.6 7.4c9.6-.6 17.8 5.6 21.8 14 2.6 5.2 2.4 10.6-1.8 12-3.4 1.2-5.6-.1-9.2.6-4.4 1-4.2 9.6-.6 23.4z"
        />
        <path className={styles.inner} d="M25.4 13.6l1.6 6.5" />
        <circle className={styles.nostril} cx="49.6" cy="34.4" r="1.25" />
        <path className={styles.line} d="M43.6 40.8c2.8 1.3 5.6 1.2 7.8-.6" />
        {/* spectacles: lens, bridge forward, arm back to the ear */}
        <circle className={styles.lens} cx="39.2" cy="25.6" r="5.4" />
        <path className={styles.wire} d="M44.6 25.2l2.4-.6M33.8 25.4l-7.6-2.6" />
        <circle className={styles.pupil} cx={px} cy={py} r="1.7" />
        <path className={styles.brow} d={BROW[mood]} />
        {/* scarf with a loose end */}
        <path className={styles.scarf} d="M17.6 49.4c8 4.4 16 4.6 23.4.2l1 7.2c-8 4.8-16.6 4.6-24.6.2z" />
        <path className={styles.scarfEnd} d="M24.6 55.4l-3.4 10.6h6.4l2.6-9.8z" />
      </g>
    </svg>
  )
}

/** One coach line: avatar on the left, the words in a speech bubble pointing at it. */
export function CoachSays({
  mood = 'idle',
  title,
  children,
  className,
}: {
  mood?: CoachMood
  /** small caption above the words; defaults to "Coach" */
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  const t = useTranslations('chess.core')
  return (
    <div className={`${styles.says} ${className ?? ''}`}>
      <CoachAvatar mood={mood} className={styles.saysAvatar} />
      <div className={styles.bubble}>
        <p className={styles.who}>{title ?? t('coach_avatar')}</p>
        {children}
      </div>
    </div>
  )
}
