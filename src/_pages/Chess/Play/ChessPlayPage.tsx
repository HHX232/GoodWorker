'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowUpDown, ChartLine, Check, CloudOff, Flag, Lock, MessageCircleQuestion, Plus, RotateCw, Undo2, X } from 'lucide-react'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { useLocalPref } from '@/shared/lib/chess/localPref'
import { ANALYSIS_KEY, type AnalysisHandoff } from '@/shared/lib/chess/reviewModel'
import type { Bot } from '@/shared/lib/chess/data'
import { ChessBoard } from '@/widgets/Chess/Board'
import { CoachPanel, CoachSays, EvalBar, useMoveCoach, type ExplainResult, type MoveReview } from '@/widgets/Chess/Coach'
import { BotAvatar, NewGameModal, type NewGameTab } from '@/widgets/Chess/Settings'
import { useChessShell } from '@/widgets/Chess/Shell'
import type { MoveFact } from '@/shared/lib/chess/gameFacts'
import { useBotGame, type EngineNote, type Side, type StartRequest } from './useBotGame'
import { useStickToEnd } from './useStickToEnd'
import styles from './ChessPlayPage.module.scss'

export type { StartRequest }

export function ChessPlayPage(props: { initialFen?: string; initialColor?: string; startNew?: StartRequest }) {
  const t = useTranslations('chess.play')
  const tc = useTranslations('chess.core')
  const ta = useTranslations('chess.analysis')
  const router = useRouter()
  const g = useBotGame(props)
  const { history, turn, start, fen, lastMove, bot, color, orientation, setFlipped, thinking, engineDown, review, reviewing, noAnalysis } = g
  const { evalCp, note, ready, badFen, pending, setPending, vsAi, coachOn, coachPick, reason, gameOver, arrows, coach } = g
  const { onMove, play, newGame, undo, resign, startBot, startDuo } = g
  const [modal, setModal] = useState<{ kind: 'new'; tab: NewGameTab } | null>(null)
  // the shell's Play / N open this page's own modal: a new game here starts in place, without navigation
  const shell = useChessShell()
  useEffect(() => {
    shell?.setNewGameHandler((tab) => setModal({ kind: 'new', tab: tab ?? (vsAi ? 'bot' : 'duo') }))
    return () => shell?.setNewGameHandler(null)
  }, [shell, vsAi])
  const [evalPref] = useLocalPref('gw-chess-evalbar', '1')
  const [autoPref] = useLocalPref('gw-chess-autoexplain', '0') // off by default: every auto call spends the limit
  const coachColRef = useStickToEnd<HTMLElement>()

  // ─── view ─────────────────────────────────────────────────────────────────────

  const startTurn = start.split(' ')[1] === 'b' ? 1 : 0
  const startNo = Number(start.split(' ')[5]) || 1
  const plies: (string | null)[] = [...Array(startTurn).fill(null), ...history]
  const rows = Array.from({ length: Math.ceil(plies.length / 2) }, (_, i) => [plies[i * 2], plies[i * 2 + 1]] as const)

  const sideLabel = (side: Side) =>
    vsAi ? (side === color ? t('you') : `${t(bot.nameKey)} · ${bot.rating}`) : t(side === 'w' ? 'white' : 'black')
  const strip = (side: Side) => {
    const toMove = !gameOver && turn === side
    const isEngine = vsAi && side !== color
    return (
      <div className={styles.strip} data-active={toMove || undefined}>
        <span className={styles.stripDot} data-side={side} aria-hidden="true" />
        {isEngine ? (
          <button type="button" className={styles.stripLevel} onClick={() => setModal({ kind: 'new', tab: 'bot' })} title={t('change_level')}>
            <BotAvatar look={bot.look} size={28} className={styles.stripAvatar} />
            {sideLabel(side)}
            <span className={styles.stripChange}>{t('change_level')}</span>
          </button>
        ) : (
          <span className={styles.stripName}>{sideLabel(side)}</span>
        )}
        {isEngine && thinking && (
          <span className={styles.stripThinking} role="status">
            <span className={styles.dots} aria-hidden="true" />
            {t('thinking')}
          </span>
        )}
      </div>
    )
  }

  // G19: the finished game goes to /chess/analysis through sessionStorage
  const openReview = () => {
    const winner = reason === 'checkmate' ? (turn === 'w' ? 'b' : 'w') : reason === 'resign' ? (color === 'w' ? 'b' : 'w') : null
    const handoff: AnalysisHandoff = {
      moves: history,
      initialFen: start,
      white: sideLabel('w'),
      black: sideLabel('b'),
      result: winner ? (winner === 'w' ? '1-0' : '0-1') : '1/2-1/2',
      source: vsAi ? 'bot' : 'duo',
    }
    try {
      sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify(handoff))
    } catch {}
    router.push('/chess/analysis')
  }

  const endText = () => {
    if (reason === 'checkmate') {
      const winner: Side = turn === 'w' ? 'b' : 'w'
      return vsAi ? t(winner === color ? 'end_mate_you' : 'end_mate_engine') : t(winner === 'w' ? 'end_mate_white' : 'end_mate_black')
    }
    return t(`end_${reason}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('play_title')}</h1>
        <div className={styles.headTools}>
          <button type="button" className={`${styles.tool} ${styles.toolStrong}`} onClick={() => setModal({ kind: 'new', tab: vsAi ? 'bot' : 'duo' })}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            {t('new_game')}
          </button>
        </div>
      </header>

      <NewGameModal
        open={modal?.kind === 'new'}
        tab={modal?.kind === 'new' ? modal.tab : undefined}
        onClose={() => setModal(null)}
        onBot={startBot}
        onDuo={startDuo}
        bot={{ botId: bot.id, level: bot.level, color, coach: coachPick }}
        botDisabled={engineDown}
      />

      {/* G05: coach | board | controls on desktop, the board centred; nothing above or beside the board changes its size */}
      <div className={styles.layout}>
        <aside ref={coachColRef} className={styles.coachCol} aria-label={tc('coach_title')}>
          {/* chronological: a special bot's greeting, the player's move review, then the engine's reply; the box scrolls to the newest */}
          {vsAi && bot.opening && <BotLine bot={bot} text={t(bot.hiKey)} />}
          {coachOn ? (
            <CoachPanel
              review={review}
              noAnalysis={noAnalysis}
              analysing={reviewing}
              explain={coach.explain}
              autoExplain={autoPref === '1'}
            />
          ) : (
            <CoachSays>{t(vsAi ? 'coach_off' : 'coach_duo')}</CoachSays>
          )}

          {coachOn && note && (
            <EngineNoteCard key={note.fenBefore + note.uci} note={note} review={coach.review} explain={coach.explain} />
          )}
        </aside>

        <section className={styles.boardCol} aria-label={tc('board_label')}>
          {strip(orientation === 'w' ? 'b' : 'w')}
          <div className={styles.stage}>
            {coachOn && evalPref === '1' && evalCp !== null && <EvalBar cp={evalCp} orientation={orientation} className={styles.evalBar} />}
            <ChessBoard
              fen={pending?.fen ?? fen}
              orientation={orientation}
              onMove={onMove}
              interactive={ready && !pending && !gameOver && !thinking && (!vsAi || turn === color)}
              lastMove={pending?.move ?? lastMove}
              check={checkSquare(pending?.fen ?? fen)}
              arrows={arrows}
            />
          </div>
          {strip(orientation)}
        </section>

        <div className={styles.controlsArea}>
          {badFen && (
            <p className={styles.engineDown} role="alert">
              <CloudOff size={16} strokeWidth={2} aria-hidden="true" />
              {t('bad_fen')}
            </p>
          )}

          {engineDown && (
            <p className={styles.engineDown} role="alert">
              <CloudOff size={16} strokeWidth={2} aria-hidden="true" />
              {tc('engine_unavailable')}
            </p>
          )}

          {pending && (
            <div className={styles.confirm} role="group" aria-label={t('confirm_prompt', { san: pending.san })}>
              <p className={styles.confirmText}>{t('confirm_prompt', { san: pending.san })}</p>
              <button type="button" className={styles.primary} onClick={() => play(pending.move)} autoFocus>
                <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                {t('confirm_move')}
              </button>
              <button type="button" className={styles.ghostDark} onClick={() => setPending(null)}>
                <X size={16} strokeWidth={2.25} aria-hidden="true" />
                {t('confirm_cancel')}
              </button>
            </div>
          )}

          {gameOver && (
            <div className={styles.end} role="status">
              <p className={styles.endText}>{endText()}</p>
              {vsAi && bot.opening && reason !== null && ['checkmate', 'resign'].includes(reason) && (
                <BotLine bot={bot} text={t(reason === 'checkmate' && turn !== color ? bot.loseKey : bot.winKey)} dark />
              )}
              <div className={styles.endActions}>
                {history.length > 0 && (
                  <button type="button" className={styles.ghostDark} onClick={openReview}>
                    <ChartLine size={16} strokeWidth={2} aria-hidden="true" />
                    {ta('review_game')}
                  </button>
                )}
                <button type="button" className={styles.primary} onClick={() => newGame()}>
                  {t('again')}
                </button>
              </div>
            </div>
          )}

          <div className={styles.controls}>
            <button type="button" className={styles.tool} onClick={undo} disabled={!history.length}>
              <Undo2 size={16} strokeWidth={2} aria-hidden="true" />
              {t('undo')}
            </button>
            <button type="button" className={styles.tool} onClick={() => setFlipped((f) => !f)}>
              <ArrowUpDown size={16} strokeWidth={2} aria-hidden="true" />
              {t('flip')}
            </button>
            {vsAi && (
              <button type="button" className={styles.tool} onClick={resign} disabled={gameOver || !history.length}>
                <Flag size={16} strokeWidth={2} aria-hidden="true" />
                {t('resign')}
              </button>
            )}
          </div>
        </div>

        <aside className={styles.rail}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('moves')}</h2>
            {rows.length === 0 ? (
              <p className={styles.muted}>{t('no_moves')}</p>
            ) : (
              <ol className={styles.moves}>
                {rows.map(([w, b], i) => (
                  <li key={i}>
                    <span className={styles.moveNo}>{startNo + i}.</span>
                    <span className={i * 2 === plies.length - 1 ? styles.moveLast : undefined}>{w ?? '…'}</span>
                    <span className={i * 2 + 1 === plies.length - 1 ? styles.moveLast : undefined}>{b ?? ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className={styles.credit}>
            {tc('engine_credit')} ·{' '}
            <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener noreferrer">
              {tc('engine_source')}
            </a>
          </p>
        </aside>
      </div>
    </div>
  )
}

// ─── R14: one line on what the engine just did, "More" asks the coach ─────────

type Coach = ReturnType<typeof useMoveCoach>

function EngineNoteCard({ note, review, explain }: { note: EngineNote; review: Coach['review']; explain: Coach['explain'] }) {
  const t = useTranslations('chess.play')
  const tc = useTranslations('chess.core')
  const [result, setResult] = useState<ExplainResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [noAnalysis, setNoAnalysis] = useState(false)
  const reviewed = useRef<MoveReview | null>(null) // a retry after UNAVAILABLE does not re-run the engine

  const factText = (f: MoveFact) => {
    switch (f.k) {
      case 'capture':
      case 'promote':
      case 'develop':
        return t(`fact_${f.k}`, { piece: t(`pc_acc_${f.piece}`) })
      case 'threat':
        return t('fact_threat', { piece: t(`pc_acc_${f.piece}`), square: f.square })
      default:
        return t(`fact_${f.k}`)
    }
  }

  // real engine facts for the engine's own move (class, best line, eval before/after), then the coach's words
  const ask = async () => {
    setResult(null)
    setNoAnalysis(false)
    let r = reviewed.current
    if (!r) {
      setAnalysing(true)
      try {
        r = await review(note.fenBefore, note.uci, 'engine-move')
      } catch (e) {
        if ((e as Error).message !== 'ENGINE_CANCELLED') setNoAnalysis(true)
        return
      } finally {
        setAnalysing(false)
      }
      reviewed.current = r
    }
    setLoading(true)
    setResult(await explain(r))
    setLoading(false)
  }

  return (
    <section aria-live="polite" aria-label={t('engine_move_title')}>
      <CoachSays mood={analysing || loading ? 'thinking' : noAnalysis || (result && !result.ok) ? 'concerned' : 'idle'}>
        <div className={styles.noteBody}>
          <p className={styles.noteLine}>
            {note.facts.length
              ? t('opp_moved_why', { san: note.san, what: note.facts.slice(0, 2).map(factText).join(t('and')) })
              : t('opp_moved', { san: note.san })}
          </p>
          {analysing && (
            <p className={styles.muted} role="status">
              <span className={styles.dots} aria-hidden="true" />
              {tc('coach_analysing')}
            </p>
          )}
          {noAnalysis && <p className={styles.muted}>{tc('coach_no_analysis')}</p>}
          {!result && !loading && !analysing && !noAnalysis && (
            <button type="button" className={styles.link} onClick={ask}>
              <MessageCircleQuestion size={15} strokeWidth={2} aria-hidden="true" />
              {t('engine_more')}
            </button>
          )}
          {loading && (
            <p className={styles.muted} role="status">
              <span className={styles.dots} aria-hidden="true" />
              {tc('coach_explaining')}
            </p>
          )}
          {result?.ok && <p className={styles.explanation}>{result.text}</p>}
          {result && !result.ok && (
            <p className={styles.notice}>
              {result.reason === 'LIMIT' ? <Lock size={15} strokeWidth={2} aria-hidden="true" /> : <CloudOff size={15} strokeWidth={2} aria-hidden="true" />}
              <span>
                {result.reason === 'LIMIT'
                  ? `${tc('coach_limit')} ${tc(result.tier === 'guest' ? 'coach_limit_guest' : 'coach_limit_user')}`
                  : tc(result.reason === 'BAD_INPUT' ? 'coach_bad_input' : 'coach_unavailable')}
              </span>
              {result.reason === 'UNAVAILABLE' && (
                <button type="button" className={styles.link} onClick={ask}>
                  <RotateCw size={13} strokeWidth={2.25} aria-hidden="true" />
                  {tc('coach_retry')}
                </button>
              )}
            </p>
          )}
        </div>
      </CoachSays>
    </section>
  )
}

// ─── G22: a special bot speaks at the start and after the result ─────────────

function BotLine({ bot, text, dark }: { bot: Bot; text: string; dark?: boolean }) {
  const t = useTranslations('chess.play')
  return (
    <div className={styles.botLine} data-dark={dark || undefined}>
      <BotAvatar look={bot.look} size={40} />
      <p>
        <strong>{t(bot.nameKey)}</strong>
        {text}
      </p>
    </div>
  )
}
