'use client'

import { useTranslations } from 'next-intl'
import { formatEval, whiteShare } from './evalFormat'
import styles from './Coach.module.scss'

export type EvalBarProps = {
  /** White's point of view, centipawns (mate as ±100000 − plies, from toWhiteCp) */
  cp: number
  /** mate in N for White (>0) or Black (<0); overrides cp when set */
  mate?: number | null
  orientation?: 'w' | 'b'
  className?: string
}

export function EvalBar({ cp, mate, orientation = 'w', className }: EvalBarProps) {
  const t = useTranslations('chess.core')
  const value = mate ? Math.sign(mate) * (100000 - (Math.abs(mate) * 2 - 1)) : cp
  const share = whiteShare(value)
  const label = formatEval(value)
  const whiteAhead = value >= 0
  return (
    <div
      className={`${styles.evalBar} ${orientation === 'b' ? styles.evalFlipped : ''} ${className ?? ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      aria-label={t('eval_label', { value: label })}
    >
      <div className={styles.evalWhite} style={{ height: `${share * 100}%` }} />
      <span className={`${styles.evalText} ${whiteAhead ? styles.evalTextWhite : styles.evalTextBlack}`}>
        {label.replace('+', '')}
      </span>
    </div>
  )
}
