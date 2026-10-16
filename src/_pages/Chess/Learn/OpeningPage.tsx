'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Chess } from 'chess.js'
import { ArrowLeft, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, CloudOff, Lock, MessageCircleQuestion, Puzzle, RotateCw, Swords } from 'lucide-react'
import { ChessBoard } from '@/widgets/Chess/Board'
import { useMoveCoach, type ExplainResult } from '@/widgets/Chess/Coach'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { playMoveSound } from '@/shared/lib/chess/sound'
import type { Opening } from '@/shared/lib/chess/data'
import { soundKind } from '../Puzzles/puzzleRun'
import { useOpeningProgress } from './openingProgress'
import styles from './Learn.module.scss'

type Ply = { fen: string; san: string; uci: string }

export function OpeningPage({ opening }: { opening: Opening }) {
  const t = useTranslations('chess.learn')
  const coach = useMoveCoach()
  const [, mark] = useOpeningProgress()

  // positions[0] = start; plies[i] leads from positions[i] to positions[i + 1]
  const { positions, plies } = useMemo(() => {
    const g = new Chess()
    const positions = [g.fen()]
    const plies: Ply[] = opening.moves.map((san) => {
      const m = g.move(san)
      positions.push(g.fen())
      return { fen: m.before, san: m.san, uci: m.from + m.to + (m.promotion ?? '') }
    })
    return { positions, plies }
  }, [opening])

  const [step, setStep] = useState(0)
  // explanation per step (kept when stepping back); 'loading' while the coach is asked
  const [ideas, setIdeas] = useState<Record<number, ExplainResult | 'loading'>>({})

  useEffect(() => mark(opening.id, 'viewed'), [opening.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to: number) => {
    const next = Math.max(0, Math.min(plies.length, to))
    if (next === step) return
    if (next > step) playMoveSound(soundKind(plies[next - 1].fen, plies[next - 1].uci))
    setStep(next)
    if (next === plies.length) mark(opening.id, 'done')
  }

  // A main-line move is a book move: no engine verdict, the coach explains its purpose (context 'opening').
  const askIdea = async (n: number) => {
    const p = plies[n - 1]
    setIdeas((m) => ({ ...m, [n]: 'loading' }))
    // For context 'opening' the server ignores classification and evals: 'best' / 0 only fill the request contract.
    const result = await coach.explain({
      classification: 'best',
      bestUci: p.uci,
      bestSan: p.san,
      playedSan: p.san,
      playedUci: p.uci,
      pvUci: [p.uci],
      evalBeforeCp: 0,
      evalAfterCp: 0,
      fenBefore: p.fen,
      context: 'opening',
    })
    setIdeas((m) => ({ ...m, [n]: result }))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') go(step + 1)
      else if (e.key === 'ArrowLeft') go(step - 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const fen = positions[step]
  const last = step > 0 ? plies[step - 1] : null
  const moverWhite = step % 2 === 1 // move `step` (1-based) was White's when odd

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/chess/learn?tab=openings" className={styles.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('op_back')}
        </Link>

        <header className={styles.openingHeader}>
          <span className={styles.eco}>{opening.eco}</span>
          <h1 className={styles.title}>{t(opening.nameKey)}</h1>
          <p className={styles.lede}>{t(opening.ideaKey)}</p>
        </header>

        <div className={styles.studyLayout}>
          <div className={styles.boardCol}>
            <ChessBoard
              fen={fen}
              orientation={opening.side}
              interactive={false}
              lastMove={last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null}
              check={checkSquare(fen)}
            />
            <div className={styles.stepper} role="group" aria-label={t('op_steps')}>
              <button type="button" className={styles.iconBtn} onClick={() => go(0)} disabled={step === 0} aria-label={t('op_first')}>
                <ChevronFirst size={18} aria-hidden="true" />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => go(step - 1)} disabled={step === 0} aria-label={t('op_prev')}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className={styles.stepCount} aria-live="polite">
                {t('op_step', { n: step, total: plies.length })}
              </span>
              <button type="button" className={`${styles.iconBtn} ${styles.iconBtnMain}`} onClick={() => go(step + 1)} disabled={step === plies.length} aria-label={t('op_next')}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => go(plies.length)} disabled={step === plies.length} aria-label={t('op_last')}>
                <ChevronLast size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <aside className={styles.side}>
            <ol className={styles.moveList} aria-label={t('op_line')}>
              {Array.from({ length: Math.ceil(plies.length / 2) }, (_, r) => (
                <li key={r} className={styles.moveRow}>
                  <span className={styles.moveNo}>{r + 1}.</span>
                  {[r * 2, r * 2 + 1].map((i) =>
                    plies[i] ? (
                      <button key={i} type="button" className={styles.moveBtn} aria-current={step === i + 1 || undefined} onClick={() => go(i + 1)}>
                        {plies[i].san}
                      </button>
                    ) : null
                  )}
                </li>
              ))}
            </ol>

            {step === 0 ? (
              <p className={styles.coachHint}>{t('op_coach_hint')}</p>
            ) : (
              <>
                <p className={styles.moveCaption}>
                  {t(moverWhite ? 'op_move_white' : 'op_move_black', { n: Math.ceil(step / 2), san: last!.san })}
                </p>
                <IdeaPanel result={ideas[step]} onAsk={() => askIdea(step)} />
              </>
            )}

            <div className={styles.actions}>
              <Link href={`/chess/play?fen=${encodeURIComponent(fen)}`} className={styles.primary}>
                <Swords size={16} aria-hidden="true" />
                {t('op_play_from_here')}
              </Link>
              <Link href={`/chess/puzzles?mode=opening&opening=${opening.lichessTag}`} className={styles.secondary}>
                <Puzzle size={16} aria-hidden="true" />
                {t('op_puzzles')}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function IdeaPanel({ result, onAsk }: { result?: ExplainResult | 'loading'; onAsk: () => void }) {
  const t = useTranslations('chess.learn')
  const tc = useTranslations('chess.core')
  return (
    <section className={styles.idea} aria-live="polite">
      <h3 className={styles.ideaTitle}>{tc('coach_title')}</h3>
      {!result ? (
        <button type="button" className={styles.ideaAsk} onClick={onAsk}>
          <MessageCircleQuestion size={16} aria-hidden="true" />
          {t('op_explain_idea')}
        </button>
      ) : result === 'loading' ? (
        <div className={styles.ideaLoading} role="status">
          <span />
          <span />
          <span className={styles.srOnly}>{tc('coach_explaining')}</span>
        </div>
      ) : result.ok ? (
        <p className={styles.ideaText}>{result.text}</p>
      ) : result.reason === 'LIMIT' ? (
        <p className={styles.ideaNotice}>
          <Lock size={15} aria-hidden="true" />
          <span>
            {tc('coach_limit')} {tc(result.tier === 'guest' ? 'coach_limit_guest' : 'coach_limit_user')}
          </span>
        </p>
      ) : (
        <p className={styles.ideaNotice}>
          <CloudOff size={15} aria-hidden="true" />
          <span>{result.reason === 'BAD_INPUT' ? tc('coach_bad_input') : t('op_idea_unavailable')}</span>
          {result.reason === 'UNAVAILABLE' && (
            <button type="button" className={styles.ideaRetry} onClick={onAsk}>
              <RotateCw size={13} aria-hidden="true" />
              {tc('coach_retry')}
            </button>
          )}
        </p>
      )}
    </section>
  )
}
