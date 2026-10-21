'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, Check, Lightbulb, ListChecks, LogIn, RotateCcw, SearchX, X } from 'lucide-react'
import { ChessBoard, getSkin, usePieceSet } from '@/widgets/Chess/Board'
import { CoachPanel, CoachSays } from '@/widgets/Chess/Coach'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { OPENINGS, TACTICS } from '@/shared/lib/chess/data'
import { Flame, todayLocal } from '@/widgets/Chess/Progress'
import { streakState } from '@/shared/lib/chess/server/progressModel'
import { LEVEL_SIZE, levelPiece, levelTerrain, pathAt, PuzzlePath } from '@/widgets/Chess/Path'
import { useStickToEnd } from '../Play/useStickToEnd'
import { MODES, SERIES_LEN, TACTIC_IDS, usePuzzleTrainer, type PuzzleMode } from './usePuzzleTrainer'
import styles from './Puzzles.module.scss'

export type { PuzzleMode }
export type PuzzlesPageProps = { mode?: PuzzleMode; theme?: string; opening?: string }

export function PuzzlesPage(props: PuzzlesPageProps) {
  const t = useTranslations('chess.learn')
  const tc = useTranslations('chess.core')
  const [pieceSet] = usePieceSet()
  const coachColRef = useStickToEnd<HTMLElement>()
  const {
    mode, view, theme, opening, puzzle, run, status, hint, wrong, profile, guest, delta, series, seriesDone, usedHelp,
    me, fen, hinted, highlights, review, noAnalysis, analysing, explain, pathNote, pathFrom, solvedSteps, pathGuest,
    myProgress, next, onMove, pickMode, pickTheme, pickOpening, takeHintStep, startPath, toPath, freePlay,
  } = usePuzzleTrainer(props)

  const statusLine =
    status === 'loading' || status === 'intro'
      ? t('pz_status_loading')
      : status === 'reply'
      ? t('pz_status_correct')
      : status === 'done'
      ? usedHelp
        ? t('pz_status_done_help')
        : t('pz_status_solved')
      : wrong
      ? t('pz_status_wrong')
      : t(me === 'w' ? 'pz_status_turn_w' : 'pz_status_turn_b')

  const pos = pathAt(solvedSteps ?? 0)
  const LevelPiece = getSkin(pieceSet).pieces[`w${levelPiece(pos.current.level)}`]
  const NextPiece = getSkin(pieceSet).pieces[`w${levelPiece(pos.current.level + 1)}`]

  if (view === 'path') {
    const streakOn = myProgress.status === 'ready' ? streakState(myProgress.profile.lastActiveDay, todayLocal()) : 'broken'
    const streak = myProgress.status === 'ready' && streakOn !== 'broken' ? myProgress.profile.streakCurrent : 0
    const coachLine =
      solvedSteps == null
        ? null
        : solvedSteps === 0
        ? t('path_coach_start')
        : t('path_coach_go', { n: pos.current.step, left: pos.toNext, next: pos.current.level + 1 })
    return (
      <div className={styles.page}>
        <div className={styles.pathScreen} data-terrain={levelTerrain(pos.current.level)}>
          <header className={styles.pathHead}>
            <h1 className={styles.title}>{t('pz_title')}</h1>
          </header>

          <div className={styles.pathCoach}>{coachLine && <CoachSays>{coachLine}</CoachSays>}</div>

          <section className={styles.levelCard} aria-label={t('path_level', { n: pos.current.level })} data-loading={solvedSteps == null || undefined}>
            <span className={styles.levelBadge} aria-hidden="true">
              <LevelPiece />
            </span>
            <span className={styles.levelName}>
              <strong>{t('path_level', { n: pos.current.level })}</strong>
              <span>{t(`path_terrain_${levelTerrain(pos.current.level)}`)}</span>
            </span>
            <span className={styles.levelStep}>
              <span className={styles.levelStepNum}>{pos.current.step}</span>
              <span>{t('path_step_word')}</span>
            </span>
            <span className={styles.levelBar} role="progressbar" aria-valuemin={0} aria-valuemax={LEVEL_SIZE} aria-valuenow={pos.done} aria-label={t('path_progress', { done: pos.done, total: LEVEL_SIZE, next: pos.current.level + 1 })}>
              <span style={{ width: `${pos.pct}%` }} />
            </span>
            <span className={styles.levelMeta}>
              <span>{t('path_progress', { done: pos.done, total: LEVEL_SIZE, next: pos.current.level + 1 })}</span>
              <span className={styles.nextPiece}>
                <NextPiece />
              </span>
            </span>
            <dl className={styles.pathStats}>
              <div>
                <dt>{t('path_solved')}</dt>
                <dd>{solvedSteps ?? '—'}</dd>
              </div>
              <div>
                <dt>{t('path_streak')}</dt>
                <dd className={styles.statFlame} data-state={streakOn}>
                  <Flame state={streakOn} size={18} />
                  {streak}
                </dd>
              </div>
              <div>
                <dt>{t('pz_rating')}</dt>
                <dd>{profile?.puzzleRating ?? (myProgress.status === 'ready' ? myProgress.profile.puzzleRating : '—')}</dd>
              </div>
            </dl>
          </section>

          <div className={styles.pathActions}>
            <button type="button" className={styles.freeBtn} onClick={freePlay} aria-label={t('path_free')} title={t('path_free')}>
              <ListChecks size={22} aria-hidden="true" />
              <span>{t('path_free')}</span>
            </button>
            <button type="button" className={styles.solveBtn} onClick={startPath} disabled={solvedSteps == null}>
              {t('path_play')}
            </button>
            {pathGuest && (
              <Link href="/login" className={styles.pathGuest}>
                <LogIn size={14} aria-hidden="true" />
                {t('path_guest')}
              </Link>
            )}
          </div>

          <div className={styles.pathMap}>
            {solvedSteps != null && <PuzzlePath solved={solvedSteps} from={pathFrom} onPlay={startPath} />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          {mode === 'path' && (
            <button type="button" className={styles.backBtn} onClick={toPath} aria-label={t('path_back')}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t('path_back')}</span>
            </button>
          )}
          <h1 className={styles.title}>{mode === 'path' ? t('path_step_title', { n: pos.current.step, level: pos.current.level }) : t('pz_title')}</h1>
          {profile ? (
            <div className={styles.rating} aria-live="polite">
              <span className={styles.ratingLabel}>{t('pz_rating')}</span>
              <span className={styles.ratingValue}>
                {profile.puzzleRating}
                {delta != null && (
                  <span key={`${puzzle?.id}${delta}`} className={styles.delta} data-sign={delta > 0 ? 'up' : 'down'}>
                    {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                  </span>
                )}
              </span>
              <span className={styles.ratingMeta}>{t('pz_counts', { solved: profile.solved, failed: profile.failed })}</span>
            </div>
          ) : guest && mode !== 'path' ? (
            <Link href="/login" className={styles.guest}>
              <LogIn size={16} aria-hidden="true" />
              <span>{t('pz_guest')}</span>
            </Link>
          ) : null}
        </header>

        {/* same frame as /chess/play: coach | board | controls, the board centred and fully on screen */}
        <div className={styles.layout}>
          <aside ref={coachColRef} className={styles.coachCol} aria-label={tc('coach_title')}>
            {wrong || review || analysing || noAnalysis ? (
              <CoachPanel review={review} noAnalysis={noAnalysis} analysing={analysing} explain={explain} />
            ) : pathNote && status === 'done' ? (
              <CoachSays key={pathNote.key}>
                {t(pathNote.key, { n: pathNote.n, piece: pathNote.piece ? t(`path_piece_${pathNote.piece}`) : '' })}
              </CoachSays>
            ) : (
              <CoachSays>{t(status === 'done' ? 'pz_coach_hint' : 'pz_lede')}</CoachSays>
            )}
          </aside>

          <div className={styles.boardCol}>
            {status === 'empty' || status === 'error' ? (
              <div className={styles.emptyBox}>
                <SearchX size={28} strokeWidth={1.75} aria-hidden="true" />
                <h2>{t(status === 'empty' ? 'pz_empty_title' : 'pz_error_title')}</h2>
                <p>{t(status === 'empty' ? 'pz_empty_text' : 'pz_error_text')}</p>
                {status === 'empty' && mode !== 'rated' ? (
                  <button type="button" className={styles.primary} onClick={() => pickMode('rated')}>
                    {t('pz_empty_reset')}
                  </button>
                ) : (
                  <button type="button" className={styles.primary} onClick={() => next()}>
                    <RotateCcw size={16} aria-hidden="true" /> {t('pz_retry')}
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className={styles.status} data-tone={status === 'done' ? (usedHelp ? 'warn' : 'ok') : wrong ? 'bad' : 'idle'} aria-live="polite">
                  <span className={styles.turnDot} data-color={me} aria-hidden="true" />
                  <span className={styles.statusText}>{statusLine}</span>
                </p>
                <div className={styles.boardWrap} data-loading={status === 'loading' || undefined}>
                  {fen ? (
                    <ChessBoard
                      fen={fen}
                      orientation={me}
                      onMove={onMove}
                      interactive={status === 'play'}
                      lastMove={run?.lastMove ?? null}
                      check={checkSquare(fen)}
                      highlights={highlights}
                      arrows={hinted && hint > 1 ? [{ from: hinted.from, to: hinted.to }] : []}
                    />
                  ) : (
                    <div className={styles.boardGhost} />
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.controlsArea}>
            {status !== 'empty' && status !== 'error' && (
              <div className={styles.controls}>
                {status !== 'done' ? (
                  <>
                    <button type="button" className={styles.secondary} disabled={status !== 'play' || hint >= 2} onClick={takeHintStep}>
                      <Lightbulb size={16} aria-hidden="true" />
                      {t(hint === 0 ? 'pz_hint' : 'pz_hint_more')}
                    </button>
                    <button type="button" className={styles.ghost} disabled={status === 'loading'} onClick={() => next()}>
                      {t('pz_skip')}
                    </button>
                  </>
                ) : seriesDone ? null : (
                  <>
                    <button type="button" className={styles.primary} onClick={() => next()}>
                      {mode === 'path'
                        ? t('path_next_step')
                        : t(mode === 'series' ? 'pz_next_series' : 'pz_next', { n: series.results.length + 1, total: SERIES_LEN })}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    {mode === 'path' && (
                      <button type="button" className={styles.secondary} onClick={toPath}>
                        {t('path_back')}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {seriesDone && (
              <section className={styles.card} aria-live="polite">
                <h2 className={styles.cardTitle}>{t('pz_series_done')}</h2>
                <p className={styles.bigScore}>
                  {t('pz_series_score', { n: series.results.filter(Boolean).length, total: SERIES_LEN })}
                </p>
                <button type="button" className={styles.primary} onClick={() => next('series')}>
                  {t('pz_series_again')}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </section>
            )}

            {puzzle && status !== 'empty' && status !== 'error' && (
              <section className={styles.card}>
                <div className={styles.meta}>
                  <span className={styles.metaLabel}>{t('pz_puzzle_rating')}</span>
                  <span className={styles.metaValue}>{puzzle.rating}</span>
                </div>
                {status === 'done' && (
                  <>
                    <div className={styles.result} data-tone={usedHelp ? 'warn' : 'ok'}>
                      {usedHelp ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                      {t(usedHelp ? 'pz_result_not_counted' : 'pz_result_solved')}
                    </div>
                    <div className={styles.tags}>
                      {puzzle.themes.filter((x) => TACTIC_IDS.has(x)).map((x) => (
                        <span key={x} className={styles.tag}>{t(`tc_${x}_name`)}</span>
                      ))}
                    </div>
                  </>
                )}
                {!profile && guest && status === 'done' && mode !== 'path' && <p className={styles.note}>{t('pz_guest_note')}</p>}
              </section>
            )}
          </div>

          <aside className={styles.side}>
            {mode === 'path' && solvedSteps != null && (
              <PuzzlePath compact solved={solvedSteps} from={pathFrom} className={styles.miniPath} />
            )}
            {mode === 'path' ? (
              <button type="button" className={styles.secondary} onClick={freePlay}>
                <ListChecks size={16} aria-hidden="true" />
                {t('path_free')}
              </button>
            ) : (
            <nav className={styles.modes} aria-label={t('pz_modes')}>
              {MODES.map((m) => (
                <button key={m} type="button" className={styles.mode} aria-pressed={mode === m} onClick={() => pickMode(m)}>
                  <span className={styles.modeName}>{t(`pz_mode_${m}`)}</span>
                  <span className={styles.modeDesc}>{t(`pz_mode_${m}_desc`)}</span>
                </button>
              ))}
            </nav>
            )}
            {mode === 'theme' && (
              <div className={styles.chips} role="group" aria-label={t('pz_pick_theme')}>
                {TACTICS.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={theme === x.id}
                    onClick={() => pickTheme(x.id)}
                  >
                    {t(x.nameKey)}
                  </button>
                ))}
              </div>
            )}
    
            {mode === 'opening' && (
              <label className={styles.selectRow}>
                <span>{t('pz_pick_opening')}</span>
                <select
                  className={styles.select}
                  value={opening}
                  onChange={(e) => pickOpening(e.target.value)}
                >
                  {OPENINGS.map((o) => (
                    <option key={o.id} value={o.lichessTag}>
                      {o.eco} · {t(o.nameKey)}
                    </option>
                  ))}
                </select>
              </label>
            )}
    
            {mode === 'series' && (
              <ol className={styles.series} aria-label={t('pz_series_progress', { n: series.results.length, total: SERIES_LEN })}>
                {Array.from({ length: SERIES_LEN }, (_, i) => {
                  const r = series.results[i]
                  const current = i === series.results.length && !seriesDone
                  return (
                    <li key={i} className={styles.seriesStep} data-state={r === true ? 'win' : r === false ? 'loss' : current ? 'now' : 'todo'}>
                      {r === true ? <Check size={14} aria-hidden="true" /> : r === false ? <X size={14} aria-hidden="true" /> : i + 1}
                    </li>
                  )
                })}
              </ol>
            )}

            <footer className={styles.footer}>
              {t('pz_credit')} ·{' '}
              <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noopener noreferrer">
                database.lichess.org
              </a>
            </footer>
          </aside>
        </div>
      </div>
    </div>
  )
}
