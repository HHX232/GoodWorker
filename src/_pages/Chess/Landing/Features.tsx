'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Mic, Video } from 'lucide-react'
import { ChessBoard, getSkin, type SkinId } from '@/widgets/Chess/Board'
import { CoachSays } from '@/widgets/Chess/Coach'
import { ClassIcon } from '@/widgets/Chess/Review'
import { BotAvatar } from '@/widgets/Chess/Settings'
import { PuzzlePath } from '@/widgets/Chess/Path'
import { Flame, RatingChip } from '@/widgets/Chess/Progress'
import { BOTS } from '@/shared/lib/chess/data'
import type { ReviewClass } from '@/shared/lib/chess/reviewModel'
import { OPERA } from './operaGame'
import s from './ChessLanding.module.scss'

// Feature tiles: each one shows a live fragment of the real chess section, not a screenshot.

/** after 6.Bc4 — the position the coach's sample line talks about; and the Opera game's final mate */
const COACH_FEN = OPERA.frames[11].fen
const FINAL_FEN = OPERA.frames[OPERA.frames.length - 1].fen

const REVIEW: ReviewClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder']
const SETS: SkinId[] = ['marble', 'grim', 'vikings', 'monsters', 'candy', 'gold', 'neon', 'classic']

function SetTile({ id }: { id: SkinId }) {
  const tc = useTranslations('chess.core')
  const set = getSkin(id)
  const board = getSkin(set.pair ?? 'classic')
  const K = set.pieces.wK
  const N = set.pieces.bN
  return (
    <li className={s.set} style={{ '--l': board.light, '--d': board.dark } as CSSProperties}>
      <div className={s.setBoard} aria-hidden="true">
        <K className={s.setPiece} />
        <N className={s.setPiece} />
      </div>
      <span>{tc(set.labelKey)}</span>
    </li>
  )
}

export function Features() {
  const t = useTranslations('chess.landing')
  const ta = useTranslations('chess.analysis')
  const tp = useTranslations('chess.play')
  const levelBots = BOTS.filter((b) => !b.opening)
  const special = BOTS.filter((b) => b.opening)

  return (
    <section id="gwl-features" className={s.feats} aria-labelledby="gwl-feats">
      <div className={s.featsHead}>
        <h2 id="gwl-feats" className={s.h2}>
          {t('feats_title')}
        </h2>
        <p className={s.lead}>{t('feats_sub')}</p>
      </div>

      <div className={s.bento}>
        <article className={`${s.tile} ${s.tCoach}`}>
          <div className={s.tileText}>
            <h3 className={s.h3}>{t('f_coach_t')}</h3>
            <p>{t('f_coach_d')}</p>
            <CoachSays mood="thinking" className={s.says}>
              <p>{t('f_coach_say')}</p>
            </CoachSays>
          </div>
          <div className={s.miniBoard}>
            <ChessBoard fen={COACH_FEN} interactive={false} coords={false} effects={false} boardId="classic" piecesId="classic" arrows={[{ from: 'c4', to: 'f7', color: '#e2561b' }]} />
          </div>
        </article>

        <article className={`${s.tile} ${s.tEngine}`}>
          <h3 className={s.h3}>{t('f_engine_t')}</h3>
          <p>{t('f_engine_d')}</p>
          <ol className={s.ladder}>
            {levelBots.map((b) => (
              <li key={b.id} style={{ '--lv': b.level } as CSSProperties}>
                <BotAvatar look={b.look} size={30 + b.level * 2} />
                <span className={s.ladderLv}>
                  {t('f_engine_lv')} {b.level}
                </span>
                <span className={s.ladderName}>{tp(b.nameKey)}</span>
              </li>
            ))}
          </ol>
          <ul className={s.specials}>
            {special.map((b) => (
              <li key={b.id} title={tp(b.nameKey)}>
                <BotAvatar look={b.look} size={34} />
                <span>{tp(b.nameKey)}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className={`${s.tile} ${s.tPath}`}>
          <h3 className={s.h3}>{t('f_path_t')}</h3>
          <p>{t('f_path_d')}</p>
          <div className={s.pathBox}>
            <PuzzlePath solved={6} compact />
          </div>
        </article>

        <article className={`${s.tile} ${s.tReview}`}>
          <h3 className={s.h3}>{t('f_review_t')}</h3>
          <p>{t('f_review_d')}</p>
          <ul className={s.classes}>
            {REVIEW.map((c) => (
              <li key={c}>
                <ClassIcon cls={c} size={22} />
                {ta(`class_${c}`)}
              </li>
            ))}
          </ul>
        </article>

        <article className={`${s.tile} ${s.tOnline}`}>
          <h3 className={s.h3}>{t('f_online_t')}</h3>
          <p>{t('f_online_d')}</p>
          <div className={s.streak}>
            <Flame state="today" size={64} className={s.flame} />
            <div>
              <p className={s.streakN}>{t('f_online_days', { n: 12 })}</p>
              <RatingChip label={t('f_online_elo')} value={1516} sub="+16" />
              <p className={s.demo}>{t('demo')}</p>
            </div>
          </div>
        </article>

        <article className={`${s.tile} ${s.tSkins}`}>
          <h3 className={s.h3}>{t('f_skins_t')}</h3>
          <p>{t('f_skins_d')}</p>
          <ul className={s.sets}>
            {SETS.map((id) => (
              <SetTile key={id} id={id} />
            ))}
          </ul>
        </article>

        <article className={`${s.tile} ${s.tTutor}`}>
          <h3 className={s.h3}>{t('f_tutor_t')}</h3>
          <p>{t('f_tutor_d')}</p>
          <div className={s.call}>
            <ChessBoard fen={FINAL_FEN} interactive={false} coords={false} effects={false} boardId="graphite" piecesId="marble" lastMove={{ from: 'd1', to: 'd8' }} check="e8" />
            <div className={s.callPeople} aria-hidden="true">
              <span>
                <Video size={14} /> {t('f_tutor_teacher')}
              </span>
              <span>
                <Mic size={14} /> {t('f_tutor_you')}
              </span>
            </div>
          </div>
          <Link href="/teachers" className={s.textLink}>
            {t('f_tutor_link')} <ArrowRight size={16} />
          </Link>
        </article>
      </div>
    </section>
  )
}
