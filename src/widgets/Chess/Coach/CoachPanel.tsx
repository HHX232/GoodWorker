'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CloudOff, Lock, MessageCircleQuestion, RotateCw } from 'lucide-react'
import type { ExplainResult, MoveReview } from './useMoveCoach'
import { formatEval } from './evalFormat'
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

type State = { review: MoveReview | null | undefined; result: ExplainResult | null; loading: boolean }

export function CoachPanel({ review, explain, onExplain, autoExplain, analysing, noAnalysis, className }: CoachPanelProps) {
  const t = useTranslations('chess.core')
  const [state, setState] = useState<State>({ review, result: null, loading: false })
  if (state.review !== review) setState({ review, result: null, loading: false })

  const ask = async () => {
    if (!review || !explain) return
    setState({ review, result: null, loading: true })
    const result = await explain(review)
    setState((s) => (s.review === review ? { review, result, loading: false } : s))
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

  return (
    <section className={`${styles.panel} ${className ?? ''}`} aria-live="polite">
      <h3 className={styles.panelTitle}>{t('coach_title')}</h3>

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
          <p className={styles.verdict} data-class={cls}>
            <span className={styles.verdictDot} aria-hidden="true" />
            {t(`class_${cls}`)}
          </p>

          <dl className={styles.moves}>
            <div>
              <dt>{t('coach_your_move')}</dt>
              <dd>{review.playedSan}</dd>
            </div>
            {cls !== 'best' && (
              <div>
                <dt>{t('coach_best_move')}</dt>
                <dd className={styles.bestMove}>{review.bestSan}</dd>
              </div>
            )}
          </dl>

          <p className={styles.evalLine}>
            {cls === 'best' ? `${t('coach_engine_agrees')} ` : ''}
            {t('coach_eval_change', { before: formatEval(review.evalBeforeCp), after: formatEval(review.evalAfterCp) })}
          </p>

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
    </section>
  )
}
