'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { GameListItem } from '@/shared/lib/chess/server/onlineStore'
import styles from './Online.module.scss'

/** «Последние партии» для /chess/profile и /chess/u/[id]: 10 законченных онлайн-партий игрока. */
export function RecentGames({ userId }: { userId: string }) {
  const t = useTranslations('chess.online')
  const [games, setGames] = useState<GameListItem[] | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/chess/games?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : { recent: [] }))
      .then((b) => live && setGames(b.recent))
      .catch(() => live && setGames([]))
    return () => {
      live = false
    }
  }, [userId])

  const outcome = (g: GameListItem) => {
    if (g.result === '1/2-1/2') return 'draw'
    return (g.result === '1-0') === (g.you === 'w') ? 'win' : 'loss'
  }

  return (
    <section className={`${styles.card} ${styles.recent}`} aria-labelledby="recent-games">
      <div className={styles.cardHead}>
        <h2 id="recent-games" className={styles.panelTitle}>{t('recent_title')}</h2>
        <Link href="/chess/online" className={styles.textLink}>{t('play_online')}</Link>
      </div>
      {!games ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : games.length === 0 ? (
        <p className={styles.muted}>{t('recent_empty')}</p>
      ) : (
        <ul className={styles.list}>
          {games.map((g) => {
            const o = outcome(g)
            return (
              <li key={g.id}>
                <span className={styles.result} data-o={o}>{t(`res_${o}`)}</span>
                <span className={styles.listText}>
                  <strong>{g.opponent ? t('vs', { name: g.opponent.name }) : '—'}</strong>
                  <span>
                    {g.timeControl}
                    {g.termination && ` · ${t(`term_${g.termination}`)}`}
                  </span>
                </span>
                {g.delta != null && (
                  <span className={styles.delta} data-sign={g.delta > 0 ? 'up' : g.delta < 0 ? 'down' : undefined}>
                    {g.delta > 0 ? `+${g.delta}` : g.delta}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
