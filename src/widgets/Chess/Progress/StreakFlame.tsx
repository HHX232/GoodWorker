'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { streakState } from '@/shared/lib/chess/server/progressModel'
import { Flame } from './Flame'
import { todayLocal, useMyChessProgress } from './useChessProgress'
import styles from './Progress.module.scss'

/** Огонёк серии для шапки шахматного раздела: пламя + число дней; ссылка в профиль. Гостю — приглашение войти. */
export function StreakFlame({ className }: { className?: string }) {
  const t = useTranslations('chess.progress')
  const me = useMyChessProgress()
  if (me.status === 'guest')
    return (
      <Link href="/login" className={`${styles.flamePill} ${className ?? ''}`} data-state="broken">
        <Flame state="broken" size={20} />
        <span className={styles.flameGuest}>{t('guest_cta')}</span>
      </Link>
    )
  if (me.status !== 'ready') return <span className={`${styles.flamePill} ${className ?? ''}`} data-state="loading" aria-hidden="true" />
  const state = streakState(me.profile.lastActiveDay, todayLocal())
  const n = state === 'broken' ? 0 : me.profile.streakCurrent
  return (
    <Link
      href="/chess/profile"
      className={`${styles.flamePill} ${className ?? ''}`}
      data-state={state}
      aria-label={t(state === 'threat' ? 'streak_label_threat' : 'streak_label', { n })}
      title={t(state === 'today' ? 'streak_today' : state === 'threat' ? 'streak_threat' : 'streak_broken')}
    >
      <Flame state={state} size={20} />
      <span className={styles.flameNum}>{n}</span>
    </Link>
  )
}
