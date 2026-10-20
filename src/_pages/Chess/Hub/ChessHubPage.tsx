'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, Globe, GraduationCap, Link2, Puzzle, Zap, type LucideIcon } from 'lucide-react'
import { ChessBoard } from '@/widgets/Chess/Board'
import { RatingChip, StreakFlame, useMyChessProgress } from '@/widgets/Chess/Progress'
import { NewGameModal, type BotChoice, type NewGameTab } from '@/widgets/Chess/Settings'
import styles from './ChessHubPage.module.scss'

// Morphy's Opera Game, 1858, after 15...Nxd7 — next comes 16.Qb8+ Nxb8 17.Rd8#
const PREVIEW_FEN = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16'

type Row = { icon: LucideIcon; title: string; text: string } & ({ href: string } | { onClick: () => void })

export function ChessHubPage() {
  const t = useTranslations('chess.play')
  const tp = useTranslations('chess.progress')
  const ts = useTranslations('chess.storm')
  const router = useRouter()
  const me = useMyChessProgress()
  const [modal, setModal] = useState<NewGameTab | null>(null)

  const rows: Row[] = [
    { href: '/chess/online', icon: Globe, title: t('tile_online'), text: t('tile_online_text') },
    { onClick: () => setModal('friend'), icon: Link2, title: t('tile_friend'), text: t('tile_friend_text') },
    { href: '/chess/puzzles', icon: Puzzle, title: t('tile_puzzles'), text: t('tile_puzzles_text') },
    { href: '/chess/storm', icon: Zap, title: t('tile_storm'), text: t('tile_storm_text') },
    { href: '/chess/learn', icon: BookOpen, title: t('tile_learn'), text: t('tile_learn_text') },
    { href: '/workflows-list?category=chess', icon: GraduationCap, title: t('tile_courses'), text: t('tile_courses_text') },
  ]

  const playBot = (c: BotChoice) => router.push(`/chess/play?new=bot&bot=${c.botId}&color=${c.color}&coach=${c.coach ? 1 : 0}`)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{t('hub_title')}</h1>
          <p className={styles.lead}>{t('hub_lead')}</p>
        </div>
        <div className={styles.me}>
          <StreakFlame />
          {me.status === 'ready' && (
            <div className={styles.chips}>
              <RatingChip label={tp('rating_online')} value={me.profile.rating} />
              <RatingChip label={tp('rating_puzzles')} value={me.profile.puzzleRating} />
              <RatingChip label={ts('best_label')} value={Math.max(me.profile.stormBest3, me.profile.stormBest5)} />
            </div>
          )}
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.play}>
          <div className={styles.playBoard} aria-hidden="true">
            <ChessBoard fen={PREVIEW_FEN} orientation="w" interactive={false} lastMove={{ from: 'f6', to: 'd7' }} arrows={[{ from: 'b3', to: 'b8' }]} />
          </div>
          <div className={styles.playText}>
            <h2>{t('tile_play')}</h2>
            <p>{t('tile_play_text')}</p>
            <div className={styles.playActions}>
              <button type="button" className={styles.cta} onClick={() => setModal('bot')}>
                {t('play_bot')}
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <Link href="/chess/play" className={styles.resume}>{t('continue_game')}</Link>
            </div>
          </div>
        </div>

        <ul className={styles.list}>
          {rows.map((r) => {
            const body = (
              <>
                <r.icon className={styles.rowIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.rowText}>
                  <strong>{r.title}</strong>
                  <span>{r.text}</span>
                </span>
                <ArrowRight className={styles.rowArrow} size={18} strokeWidth={2} aria-hidden="true" />
              </>
            )
            return (
              <li key={r.title}>
                {'href' in r ? (
                  <Link href={r.href} className={styles.row}>{body}</Link>
                ) : (
                  <button type="button" className={styles.row} onClick={r.onClick}>{body}</button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <p className={styles.credit}>
        {t('credit_lichess')} ·{' '}
        <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener noreferrer">
          {t('credit_stockfish')}
        </a>
      </p>

      <NewGameModal open={modal !== null} tab={modal ?? undefined} onClose={() => setModal(null)} onBot={playBot} onDuo={() => router.push('/chess/play?new=duo')} />
    </div>
  )
}
