'use client'

import { ChessKnight, ChevronRight } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BadgeMedal, Flame, RatingChip, badgeText } from '@/widgets/Chess/Progress'
import styles from './ChessTutorBlock.module.scss'

type PublicProfile = {
  rating: number
  ratingGames: number
  puzzleRating: number
  puzzlesSolved: number
  streakCurrent: number
  badges: { code: string; earnedAt: string }[]
}

const MAX_MEDALS = 5

/** Блок «Шахматный репетитор» в публичном профиле: рейтинги, серия, значки, вызов на партию, запись на шахматную услугу. */
/** `onBook` — запись на шахматную услугу от DashboardCenter (правило «кто может записаться» живёт там); null/undefined — кнопки нет. */
export function ChessTutorBlock({ teacherId, onBook }: { teacherId: string; onBook?: (() => void) | null }) {
  const t = useTranslations('chess.tutor')
  const tp = useTranslations('chess.progress')
  const router = useRouter()
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<PublicProfile | null | 'error'>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/chess/profile/${encodeURIComponent(teacherId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => alive && setProfile(d.profile))
      .catch(() => alive && setProfile('error'))
    return () => { alive = false }
  }, [teacherId])

  const viewer = session?.user
  const isOwner = viewer?.id === teacherId
  const guest = status === 'unauthenticated'
  const toLogin = () => router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname + location.search)}`)

  const challenge = async () => {
    if (guest) return toLogin()
    setCreating(true)
    try {
      const res = await fetch('/api/chess/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeControl: '10+0', opponentId: teacherId }),
      })
      if (res.status === 401) return toLogin()
      if (res.status === 404) return void toast.error(t('play_unavailable'))
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.id) return void toast.error(t('play_error'))
      router.push(`/chess/game/${d.id}`)
    } catch {
      toast.error(t('play_error'))
    } finally {
      setCreating(false)
    }
  }

  const earned = profile && profile !== 'error' ? profile.badges : []

  return (
    <section className={styles.block} aria-labelledby="chess-tutor-title">
      <header className={styles.head}>
        <span className={styles.mark} aria-hidden="true">
          <ChessKnight size={16} strokeWidth={2} />
        </span>
        <h2 id="chess-tutor-title" className={styles.title}>{t('title')}</h2>
        <Link href={`/chess/u/${teacherId}`} className={styles.more} aria-label={t('profile_link')} title={t('profile_link')}>
          <ChevronRight size={16} strokeWidth={2} />
        </Link>
      </header>

      {profile === 'error' ? (
        <p className={styles.muted}>{t('load_error')}</p>
      ) : !profile ? (
        <div className={styles.skeleton} aria-hidden="true" />
      ) : (
        <>
          <div className={styles.ratings}>
            <RatingChip label={tp('rating_online')} value={profile.rating} sub={tp('rating_games', { n: profile.ratingGames })} />
            <RatingChip label={tp('rating_puzzles')} value={profile.puzzleRating} sub={tp('rating_solved', { n: profile.puzzlesSolved })} />
          </div>

          <p className={styles.streak}>
            <Flame state={profile.streakCurrent > 0 ? 'today' : 'broken'} size={18} className={styles.still} />
            {t('streak', { n: profile.streakCurrent })}
          </p>

          {earned.length === 0 ? (
            <p className={styles.muted}>{t('no_badges')}</p>
          ) : (
            <ul className={styles.medals} aria-label={tp('badges_title')}>
              {earned.slice(0, MAX_MEDALS).map((b) => {
                const { group, nameKey, values } = badgeText(b.code)
                const name = tp(nameKey, values)
                return (
                  <li key={b.code} title={name}>
                    <BadgeMedal group={group} n={values.n} earned size={40} />
                    <span className={styles.srOnly}>{name}</span>
                  </li>
                )
              })}
              {earned.length > MAX_MEDALS && (
                <li>
                  <Link href={`/chess/u/${teacherId}`} className={styles.moreMedals}>{t('more_badges', { n: earned.length - MAX_MEDALS })}</Link>
                </li>
              )}
            </ul>
          )}
        </>
      )}

      {!isOwner && (
        <div className={styles.actions}>
          <button type="button" className={styles.play} onClick={challenge} disabled={creating || status === 'loading'}>
            {creating ? t('play_creating') : guest ? t('login_to_play') : t('play')}
          </button>
          {onBook && (
            <button type="button" className={styles.book} onClick={onBook}>
              {t('book')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
