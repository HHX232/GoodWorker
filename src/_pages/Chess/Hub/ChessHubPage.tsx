'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Chess } from 'chess.js'
import { ChessPawn, Globe, GraduationCap, Link2, Play, Radio } from 'lucide-react'
import { ChessBoard } from '@/widgets/Chess/Board'
import { CoachAvatar } from '@/widgets/Chess/Coach'
import { Flame, todayLocal, useMyChessProgress } from '@/widgets/Chess/Progress'
import { BotAvatar } from '@/widgets/Chess/Settings'
import { pathAt, usePathProgress } from '@/widgets/Chess/Path'
import { useChessShell, type ShellLayer } from '@/widgets/Chess/Shell'
import { OPENINGS, getBot, levelBot } from '@/shared/lib/chess/data'
import { useLocalPref } from '@/shared/lib/chess/localPref'
import { streakState } from '@/shared/lib/chess/server/progressModel'
import type { GameListItem } from '@/shared/lib/chess/server/onlineStore'
import { useOpeningProgress } from '../Learn/openingProgress'
import { DailyPuzzle } from './DailyPuzzle'
import styles from './ChessHubPage.module.scss'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
/** quick pairing from the hub: 10 min, 5 min, 3+2 */
const QUICK = [
  { tc: '10+0', min: 10 },
  { tc: '5+0', min: 5 },
  { tc: '3+2', min: null },
] as const

type Unfinished = { plies: number; botName: string | null }

/** The bot/duo game saved by /chess/play (`gw-chess-game`) if it is still going. */
function unfinished(raw: string): Unfinished | null {
  try {
    const s = JSON.parse(raw || 'null') as { start?: string; moves?: string[]; mode?: string; botId?: string; resigned?: boolean } | null
    if (!s || typeof s.start !== 'string' || !Array.isArray(s.moves) || !s.moves.length || s.resigned) return null
    const g = new Chess(s.start)
    for (const san of s.moves) g.move(san)
    if (g.isGameOver()) return null
    return { plies: s.moves.length, botName: s.mode === 'duo' ? null : getBot(s.botId)?.nameKey ?? null }
  } catch {
    return null // a broken save: no "continue"
  }
}

const fenAfter = (moves: string[]) => {
  const g = new Chess()
  for (const san of moves) g.move(san)
  return g.fen()
}

/** The chess home, chess.com-style: play on the left, puzzles · lesson · bots as board cards on the right. */
export function ChessHubPage() {
  const t = useTranslations('chess.play')
  const tl = useTranslations('chess.learn')
  const tp = useTranslations('chess.progress')
  const to = useTranslations('chess.online')
  const shell = useChessShell()
  const me = useMyChessProgress()
  const { status } = useSession()
  const [tc, setTc] = useState<string>('10+0')
  const [saved] = useLocalPref('gw-chess-game', '')
  const game = useMemo(() => unfinished(saved), [saved])
  const [marks] = useOpeningProgress()
  const [online, setOnline] = useState<GameListItem | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') return
    let live = true
    fetch('/api/chess/games', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { active?: GameListItem[] } | null) => live && setOnline(b?.active?.find((g) => g.status === 'active') ?? null))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [status])

  const open = (l: ShellLayer) => shell?.open(l)
  const profile = me.status === 'ready' ? me.profile : null
  const player = me.status === 'ready' ? me.player : null
  const streakOn = profile ? streakState(profile.lastActiveDay, todayLocal()) : 'broken'
  const streak = profile && streakOn !== 'broken' ? profile.streakCurrent : 0

  const puzzleRating = profile?.puzzleRating ?? 1200
  // the puzzle path's level (task 19): 20 clean solves per level
  const path = pathAt(usePathProgress().solved ?? 0)
  const level = path.current.level
  const levelPct = path.pct

  const lesson = OPENINGS.find((o) => marks[o.id] !== 'done') ?? OPENINGS[0]
  const lessonFen = useMemo(() => fenAfter(lesson.moves), [lesson])

  // the next bot to beat: the weakest level without its first-win badge
  const earned = new Set(profile?.badges.map((b) => b.code) ?? [])
  const nextBot = levelBot([1, 2, 3, 4, 5, 6, 7, 8].find((l) => !earned.has(`first_win_l${l}`)) ?? 8)
  const coachBot = getBot(JSON.parse(saved || 'null')?.botId)?.id ?? levelBot(3).id

  return (
    <div className={styles.page}>
      <header className={styles.who}>
        <div className={styles.player}>
          {player?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- аватары с внешних доменов, как в остальном приложении
            <img src={player.avatarUrl} alt="" className={styles.avatar} width={40} height={40} />
          ) : (
            <span className={styles.avatar} aria-hidden="true">{player?.name ? player.name.slice(0, 1) : <ChessPawn size={20} strokeWidth={1.75} />}</span>
          )}
          {me.status === 'guest' ? (
            <Link href="/login" className={styles.name}>{t('sh_guest')} · {tp('login')}</Link>
          ) : (
            <span className={styles.name}>{player?.name ?? (me.status === 'loading' ? '' : t('hub_title'))}</span>
          )}
          {profile && <span className={styles.elo}>{profile.rating}</span>}
        </div>
        {profile && (
          <Link href="/chess/profile" className={styles.days} data-state={streakOn} aria-label={tp('streak_days', { n: streak })}>
            <Flame state={streakOn} size={30} />
            <span>{t('sh_days', { n: streak })}</span>
          </Link>
        )}
      </header>

      <div className={styles.room}>
        <section className={styles.playPanel} aria-labelledby="hub-play">
          <h1 id="hub-play" className={styles.panelTitle}>{t('sh_play')}</h1>
          <div className={styles.seg} role="radiogroup" aria-label={t('sh_tc_group')}>
            {QUICK.map((q) => (
              <button key={q.tc} type="button" role="radio" aria-checked={tc === q.tc} onClick={() => setTc(q.tc)}>
                {q.min ? t('sh_tc_min', { n: q.min }) : q.tc}
              </button>
            ))}
          </div>
          <button type="button" className={styles.start} onClick={() => open({ k: 'online', tc, seek: true })} aria-haspopup="dialog">
            {t('sh_start')}
          </button>

          <div className={styles.modes}>
            {online && (
              <Link href={`/chess/game/${online.id}`} className={styles.mode} data-live>
                <Radio className={styles.modeIcon} size={20} strokeWidth={2} aria-hidden="true" />
                <span className={styles.modeText}>
                  <strong>{t('sh_online_now')}</strong>
                  <span>{online.opponent ? to('vs', { name: online.opponent.name }) : to('open_seat')} · {online.timeControl}</span>
                </span>
              </Link>
            )}
            {game && (
              <Link href="/chess/play" className={styles.mode}>
                <Play className={styles.modeIcon} size={20} strokeWidth={2} aria-hidden="true" />
                <span className={styles.modeText}>
                  <strong>{t('continue_game')}</strong>
                  <span>
                    {game.botName ? t('sh_continue_bot', { bot: t(game.botName) }) : t('sh_continue_duo')} · {t('sh_moves', { n: Math.ceil(game.plies / 2) })}
                  </span>
                </span>
              </Link>
            )}
            <button type="button" className={styles.mode} onClick={() => open({ k: 'online', tc })} aria-haspopup="dialog">
              <Globe className={styles.modeIcon} size={20} strokeWidth={2} aria-hidden="true" />
              <strong>{t('sh_play_online')}</strong>
            </button>
            <button type="button" className={styles.mode} onClick={() => open({ k: 'new', tab: 'bot' })} aria-haspopup="dialog">
              <BotAvatar look={levelBot(3).look} size={26} className={styles.modeArt} />
              <strong>{t('sh_play_bot')}</strong>
            </button>
            <Link href={`/chess/play?new=bot&bot=${coachBot}&color=w&coach=1`} className={styles.mode}>
              <CoachAvatar size={26} className={styles.modeArt} />
              <strong>{t('sh_play_coach')}</strong>
            </Link>
            <button type="button" className={styles.mode} onClick={() => open({ k: 'new', tab: 'friend' })} aria-haspopup="dialog">
              <Link2 className={styles.modeIcon} size={20} strokeWidth={2} aria-hidden="true" />
              <strong>{t('sh_play_friend')}</strong>
            </button>
          </div>
        </section>

        <div className={styles.cards}>
          <section className={styles.card} aria-label={tl('pz_title')}>
            <DailyPuzzle />
            <div className={styles.cardInfo}>
              <span className={styles.level} aria-label={tl('path_level_aria', { n: level, left: path.toNext })}>{level}</span>
              <div className={styles.levelText}>
                <span className={styles.levelLine}>
                  <strong>{puzzleRating}</strong>
                  {profile && (
                    <span className={styles.miniFlame} data-state={streakOn}>
                      <Flame state={streakOn} size={14} />
                      {streak}
                    </span>
                  )}
                </span>
                <span className={styles.bar} aria-hidden="true">
                  <span style={{ width: `${levelPct}%` }} />
                </span>
              </div>
            </div>
            <Link href="/chess/puzzles" className={styles.cardBtn}>{t('sh_solve')}</Link>
          </section>

          <section className={styles.card} aria-label={tl('ln_title')}>
            <Link href={`/chess/learn/opening/${lesson.id}`} className={styles.cardBoard} tabIndex={-1} aria-hidden="true">
              <ChessBoard fen={lessonFen} orientation={lesson.side} interactive={false} coords={false} />
            </Link>
            <p className={styles.caption}>
              <span className={styles.captionKey}>{lesson.eco}</span>
              <span>{tl('ln_tab_openings')}</span>
            </p>
            <div className={styles.cardInfo}>
              <GraduationCap className={styles.cardIcon} size={30} strokeWidth={1.75} aria-hidden="true" />
              <strong className={styles.cardName}>{tl(lesson.nameKey)}</strong>
            </div>
            <Link href={`/chess/learn/opening/${lesson.id}`} className={styles.cardBtn}>{t('sh_next_lesson')}</Link>
          </section>

          <section className={styles.card} aria-label={t('sh_bots')}>
            <div className={styles.cardBoard} aria-hidden="true" onClick={() => open({ k: 'new', tab: 'bot', bot: nextBot.id })}>
              <ChessBoard fen={START_FEN} orientation="w" interactive={false} coords={false} />
            </div>
            <p className={styles.caption}>
              <span className={styles.captionKey}>{t('sh_bots')}</span>
              <span>{t('sh_level', { n: nextBot.level })}</span>
            </p>
            <div className={styles.cardInfo}>
              <BotAvatar look={nextBot.look} size={36} />
              <strong className={styles.cardName}>
                {t(nextBot.nameKey)} <span>({nextBot.rating})</span>
              </strong>
            </div>
            <button type="button" className={styles.cardBtn} onClick={() => open({ k: 'new', tab: 'bot', bot: nextBot.id })} aria-haspopup="dialog">
              {t('sh_bots')}
            </button>
          </section>
        </div>
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
