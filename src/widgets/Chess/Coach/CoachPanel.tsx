'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CloudOff, Lock, MessageCircleQuestion, RotateCw } from 'lucide-react'
import { engineMoveFacts, type MoveFact } from '@/shared/lib/chess/gameFacts'
import type { ExplainResult, MoveReview } from './useMoveCoach'
import { bestLine, mistakeLine } from './coachSay'
import { CoachSays, type CoachMood } from './CoachAvatar'
import styles from './Coach.module.scss'

export type CoachPanelProps = {
  review?: MoveReview | null
  /** usually `useMoveCoach().explain`; without it there is no "Why?" button */
  explain?: (review: MoveReview) => Promise<ExplainResult>
  /** called with every explanation result (e.g. to log or to show a sign-in prompt elsewhere) */
  onExplain?: (result: ExplainResult) => void
  /** ask automatically after a mistake or a blunder */
  autoExplain?: boolean
  /** engine is still reviewing the last move */
  analysing?: boolean
  /** review of the last move failed (anything but ENGINE_CANCELLED) — shows `coach_no_analysis`, hides `review` */
  noAnalysis?: boolean
  className?: string
}

/** `turn` растёт с каждым новым ходом — по нему чередуются шаблоны строки, чтобы фраза не повторялась подряд. */
type State = { review: MoveReview | null | undefined; result: ExplainResult | null; loading: boolean; turn: number }
const FACT_VARIANTS = 3

export function CoachPanel({ review, explain, onExplain, autoExplain, analysing, noAnalysis, className }: CoachPanelProps) {
  const t = useTranslations('chess.core')
  const tp = useTranslations('chess.play')
  const [state, setState] = useState<State>({ review, result: null, loading: false, turn: 0 })
  if (state.review !== review) setState({ review, result: null, loading: false, turn: state.turn + 1 })

  const ask = async () => {
    if (!review || !explain) return
    setState((s) => ({ ...s, review, result: null, loading: true }))
    const result = await explain(review)
    setState((s) => (s.review === review ? { ...s, review, result, loading: false } : s))
    onExplain?.(result)
  }

  const wantsAuto = !!autoExplain && !noAnalysis && !!review && (review.classification === 'mistake' || review.classification === 'blunder')
  const autoAsked = useRef<MoveReview | null>(null) // one POST per review, StrictMode double effects included
  useEffect(() => {
    if (!wantsAuto || autoAsked.current === review) return
    autoAsked.current = review ?? null
    void ask()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, wantsAuto])

  const cls = review?.classification
  const result = state.result

  const factText = (f: MoveFact) =>
    f.k === 'capture' || f.k === 'promote' || f.k === 'develop'
      ? tp(`fact_${f.k}`, { piece: tp(`pc_acc_${f.piece}`) })
      : f.k === 'threat'
        ? tp('fact_threat', { piece: tp(`pc_acc_${f.piece}`), square: f.square })
        : tp(`fact_${f.k}`)
  // Для best/good — не похвала-шаблон, а что ход конкретно сделал (взятие/шах/угроза/развитие); тихий ход — без строки.
  const factLine = (r: MoveReview): string | null => {
    let facts: MoveFact[]
    try {
      facts = engineMoveFacts(r.fenBefore, r.playedUci).facts.filter((f) => f.k !== 'quiet')
    } catch {
      return null // ход не разобрался — строки просто нет, вердикт и «Почему?» остаются
    }
    if (!facts.length) return null
    const fact = facts.slice(0, 2).map(factText).join(t('say_and'))
    return t(`say_fact_${(state.turn % FACT_VARIANTS) + 1}`, { played: r.playedSan, fact })
  }
  // G41/G42: a tactic the best move carries (for `best` that is the played move itself) is said instead of a plain fact
  const own = review?.why ? bestLine(review.why, t, tp) : null
  const sayText = !review
    ? ''
    : cls === 'best'
      ? own ?? factLine(review) ?? ''
      : cls === 'good'
        ? [factLine(review), own ?? t('say_good', { best: review.bestSan })].filter(Boolean).join(' ')
        : (review.why && mistakeLine(review.why, cls!, review.playedSan, t, tp, state.turn)) ||
          t(`say_${cls}`, { played: review.playedSan, best: review.bestSan })

  const mood: CoachMood = analysing || state.loading ? 'thinking' : noAnalysis || (result && !result.ok) ? 'concerned' : 'idle'

  return (
    <section className={`${styles.panel} ${className ?? ''}`} aria-live="polite" aria-label={t('coach_title')}>
      <CoachSays mood={mood}>

        {analysing ? (
          <p className={styles.muted}>
            <span className={styles.pulse} aria-hidden="true" />
            {t('coach_analysing')}
          </p>
        ) : noAnalysis ? (
          <p className={styles.muted}>{t('coach_no_analysis')}</p>
        ) : !review ? (
          <p className={styles.muted}>{t('coach_idle')}</p>
        ) : (
          <>
            {sayText && (
              <p className={styles.say} data-class={cls}>
                <span className={styles.verdictDot} aria-hidden="true" />
                <span>{sayText}</span>
              </p>
            )}

            {explain && !result && !state.loading && (
              <button type="button" className={styles.whyButton} onClick={ask}>
                <MessageCircleQuestion size={16} strokeWidth={2} aria-hidden="true" />
                {t('coach_why')}
              </button>
            )}

            {state.loading && (
              <div className={styles.thinking} role="status">
                <span className={styles.skeleton} />
                <span className={styles.skeleton} />
                <span className={styles.srOnly}>{t('coach_explaining')}</span>
              </div>
            )}

            {result?.ok && <p className={styles.explanation}>{result.text}</p>}

            {result && !result.ok && result.reason === 'LIMIT' && (
              <p className={styles.notice}>
                <Lock size={15} strokeWidth={2} aria-hidden="true" />
                <span>
                  {t('coach_limit')} {t(result.tier === 'guest' ? 'coach_limit_guest' : 'coach_limit_user')}
                </span>
              </p>
            )}

            {result && !result.ok && result.reason !== 'LIMIT' && (
              <p className={styles.notice}>
                <CloudOff size={15} strokeWidth={2} aria-hidden="true" />
                <span>{t(result.reason === 'BAD_INPUT' ? 'coach_bad_input' : 'coach_unavailable')}</span>
                {result.reason === 'UNAVAILABLE' && (
                  <button type="button" className={styles.retry} onClick={ask}>
                    <RotateCw size={13} strokeWidth={2.25} aria-hidden="true" />
                    {t('coach_retry')}
                  </button>
                )}
              </p>
            )}
          </>
        )}
      </CoachSays>
    </section>
  )
}
