'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, LogIn } from 'lucide-react'
import type { ChessPlayerDto, ChessProgressDto } from '@/shared/lib/chess/server/progress'
import { POINT_STEPS, streakState } from '@/shared/lib/chess/server/progressModel'
import { BadgeGrid, Flame, RatingChip, badgeText, nextPointStep, todayLocal, useMyChessProgress, type FlameState } from '@/widgets/Chess/Progress'
import styles from './ChessProfilePage.module.scss'

type Loaded = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; player: ChessPlayerDto | null; profile: ChessProgressDto }

function usePublicProgress(userId: string | undefined): Loaded {
  const [s, setS] = useState<Loaded>({ status: 'loading' })
  useEffect(() => {
    if (!userId) return
    let live = true
    fetch(`/api/chess/profile/${encodeURIComponent(userId)}`)
      .then(async (r) => {
        if (!live) return
        if (r.status === 404) return setS({ status: 'missing' })
        if (!r.ok) throw new Error(String(r.status))
        const b = await r.json()
        if (live) setS({ status: 'ready', player: b.player, profile: b.profile })
      })
      .catch(() => live && setS({ status: 'error' }))
    return () => {
      live = false
    }
  }, [userId])
  return s
}

/** /chess/profile (свой, с «сегодня уже играл?») и /chess/u/[id] (публичный). */
export function ChessProfilePage({ userId }: { userId?: string }) {
  const t = useTranslations('chess.progress')
  const mine = useMyChessProgress()
  const other = usePublicProgress(userId)
  const s = userId ? other : mine

  return (
    <div className={styles.page}>
      <Link href="/chess" className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        {t('back')}
      </Link>

      {s.status === 'loading' && <div className={styles.skeleton} aria-busy="true" />}
      {s.status === 'guest' && (
        <div className={styles.empty}>
          <Flame state="broken" size={56} />
          <h1>{t('guest_title')}</h1>
          <p>{t('guest_text')}</p>
          <Link href="/login" className={styles.primary}>
            <LogIn size={18} strokeWidth={2} aria-hidden="true" />
            {t('login')}
          </Link>
        </div>
      )}
      {(s.status === 'missing' || s.status === 'error') && (
        <div className={styles.empty} role="alert">
          <h1>{t(s.status === 'missing' ? 'not_found' : 'load_error')}</h1>
        </div>
      )}
      {s.status === 'ready' && <Profile player={s.player} profile={s.profile} own={!userId} />}
    </div>
  )
}

function Profile({ player, profile, own }: { player: ChessPlayerDto | null; profile: ChessProgressDto; own: boolean }) {
  const t = useTranslations('chess.progress')
  // публичный профиль уже обнулил сгоревшую серию на сервере; свой считаем в поясе пользователя
  const state: FlameState = own ? streakState(profile.lastActiveDay, todayLocal()) : profile.streakCurrent > 0 ? 'today' : 'broken'
  const streak = state === 'broken' ? 0 : profile.streakCurrent
  const next = nextPointStep(profile.botPoints)
  const prev = [0, ...POINT_STEPS].filter((x) => x <= profile.botPoints).at(-1) ?? 0
  const pct = next ? Math.round(((profile.botPoints - prev) / (next - prev)) * 100) : 100

  return (
    <>
      <header className={styles.head}>
        {player?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- аватары с внешних доменов, как в остальном приложении
          <img src={player.avatarUrl} alt="" className={styles.avatar} width={64} height={64} />
        ) : (
          <span className={styles.avatar} aria-hidden="true">{player?.name.slice(0, 1)}</span>
        )}
        <div className={styles.who}>
          <h1>{player?.name ?? t('profile_title')}</h1>
          <p>
            {t(own ? 'profile_me' : 'profile_title')}
            {player?.isTeacher && <span className={styles.tag}>{t('tutor_tag')}</span>}
          </p>
        </div>
      </header>

      <div className={styles.top}>
        <section className={styles.streak} data-state={state} aria-labelledby="chess-streak">
          <Flame state={state} size={88} className={styles.bigFlame} />
          <div className={styles.streakText}>
            <h2 id="chess-streak">{t('streak_days', { n: streak })}</h2>
            {own && <p className={styles.streakState}>{t(state === 'today' ? 'streak_today' : state === 'threat' ? 'streak_threat' : 'streak_broken')}</p>}
            <p className={styles.streakBest}>{t('streak_best', { n: profile.streakBest })}</p>
          </div>
        </section>

        <section className={styles.stats}>
          <div className={styles.ratings}>
            <RatingChip label={t('rating_online')} value={profile.rating} sub={t('rating_games', { n: profile.ratingGames })} />
            <RatingChip label={t('rating_puzzles')} value={profile.puzzleRating} sub={t('rating_solved', { n: profile.puzzlesSolved })} />
          </div>
          <div className={styles.points}>
            <RatingChip label={t('points_title')} value={profile.botPoints} />
            <div className={styles.meter} role="progressbar" aria-valuemin={prev} aria-valuemax={next ?? profile.botPoints} aria-valuenow={profile.botPoints}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className={styles.pointsNext}>
              {next ? t('points_next', { n: next - profile.botPoints, name: t(badgeText(`points_${next}`).nameKey, { n: next }) }) : t('points_max')}
            </p>
            <p className={styles.rule}>{t('points_rule')}</p>
            {own && profile.botPoints === 0 && (
              <Link href="/chess/play" className={styles.cta}>
                {t('play_cta')}
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      </div>

      <BadgeGrid earned={profile.badges} />
    </>
  )
}
