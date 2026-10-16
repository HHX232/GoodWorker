import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, GraduationCap, Puzzle } from 'lucide-react'
import { ChessBoard } from '@/widgets/Chess/Board'
import styles from './ChessHubPage.module.scss'

// Morphy's Opera Game, 1858, after 15...Nxd7 — next comes 16.Qb8+ Nxb8 17.Rd8#
const PREVIEW_FEN = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16'

export function ChessHubPage() {
  const t = useTranslations('chess.play')
  const rows = [
    { href: '/chess/puzzles', icon: Puzzle, title: t('tile_puzzles'), text: t('tile_puzzles_text') },
    { href: '/chess/learn', icon: BookOpen, title: t('tile_learn'), text: t('tile_learn_text') },
    { href: '/workflows-list?category=chess', icon: GraduationCap, title: t('tile_courses'), text: t('tile_courses_text') },
  ]

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('hub_title')}</h1>
      <p className={styles.lead}>{t('hub_lead')}</p>

      <div className={styles.grid}>
        <Link href="/chess/play" className={styles.play}>
          <div className={styles.playBoard} aria-hidden="true">
            <ChessBoard fen={PREVIEW_FEN} orientation="w" interactive={false} lastMove={{ from: 'f6', to: 'd7' }} arrows={[{ from: 'b3', to: 'b8' }]} />
          </div>
          <div className={styles.playText}>
            <h2>{t('tile_play')}</h2>
            <p>{t('tile_play_text')}</p>
            <span className={styles.cta}>
              {t('tile_play_cta')}
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </span>
          </div>
        </Link>

        <ul className={styles.list}>
          {rows.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link href={href} className={styles.row}>
                <Icon className={styles.rowIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.rowText}>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </span>
                <ArrowRight className={styles.rowArrow} size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.credit}>
        {t('credit_lichess')} ·{' '}
        <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener noreferrer">
          {t('credit_stockfish')}
        </a>
      </p>
    </div>
  )
}
