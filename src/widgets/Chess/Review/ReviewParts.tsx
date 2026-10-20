'use client'

import { useEffect, useRef, type PointerEvent } from 'react'
import { useTranslations } from 'next-intl'
import { KEY_CLASSES, REVIEW_CLASSES, type GameReview, type ReviewedMove } from '@/shared/lib/chess/reviewModel'
import { CLASS_COLOR, ClassIcon } from './ClassIcon'
import styles from './Review.module.scss'

// ─── Accuracy of both sides + class counts (the chess.com card) ──────────────

export function AccuracyCard({ review, white, black }: { review: GameReview; white: string; black: string }) {
  const t = useTranslations('chess.analysis')
  const fmt = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
  return (
    <section className={styles.accuracy} aria-label={t('accuracy')}>
      <div className={styles.accHead}>
        <div className={styles.accSide}>
          <span className={styles.accDot} data-side="w" aria-hidden="true" />
          <span className={styles.accName}>{white}</span>
          <strong className={styles.accValue}>{fmt(review.accuracy.w)}</strong>
        </div>
        <span className={styles.accLabel}>{t('accuracy')}</span>
        <div className={`${styles.accSide} ${styles.accRight}`}>
          <span className={styles.accDot} data-side="b" aria-hidden="true" />
          <span className={styles.accName}>{black}</span>
          <strong className={styles.accValue}>{fmt(review.accuracy.b)}</strong>
        </div>
      </div>
      <table className={styles.counts}>
        <tbody>
          {REVIEW_CLASSES.map((c) => (
            <tr key={c} data-zero={!review.counts.w[c] && !review.counts.b[c] ? '' : undefined}>
              <th scope="row">{t(`class_${c}`)}</th>
              <td style={{ color: review.counts.w[c] ? CLASS_COLOR[c] : undefined }}>{review.counts.w[c]}</td>
              <td className={styles.countIcon}>
                <ClassIcon cls={c} size={20} />
              </td>
              <td style={{ color: review.counts.b[c] ? CLASS_COLOR[c] : undefined }}>{review.counts.b[c]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// ─── Eval graph: White's win% after every ply; click → that move ─────────────

const GW = 600
const GH = 120

export function EvalGraph({ moves, current, onPick }: { moves: ReviewedMove[]; current: number; onPick: (ply: number) => void }) {
  const t = useTranslations('chess.analysis')
  const n = moves.length
  const x = (i: number) => ((i + 1) / n) * GW // i = −1 → the start position at x = 0
  const y = (win: number) => GH - (win / 100) * GH
  const line = [`M0 ${y(50)}`, ...moves.map((m, i) => `L${x(i)} ${y(m.whiteWin)}`)].join(' ')

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onPick(Math.min(n - 1, Math.max(-1, Math.round(((e.clientX - r.left) / r.width) * n) - 1)))
  }

  return (
    <div className={styles.graph}>
      <svg viewBox={`0 0 ${GW} ${GH}`} preserveAspectRatio="none" role="img" aria-label={t('graph_label')} onPointerDown={pick}>
        <rect width={GW} height={GH} className={styles.graphBlack} />
        <path d={`${line} L${GW} ${GH} L0 ${GH}Z`} className={styles.graphWhite} />
        <path d={`M0 ${GH / 2}H${GW}`} className={styles.graphMid} vectorEffect="non-scaling-stroke" />
        {current >= 0 && <path d={`M${x(current)} 0V${GH}`} className={styles.graphCursor} vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* key moments as round dots: HTML so they stay round on the stretched SVG */}
      {moves.map((m, i) =>
        KEY_CLASSES.includes(m.cls) ? (
          <span
            key={i}
            className={styles.graphDot}
            data-current={i === current ? '' : undefined}
            style={{ left: `${(x(i) / GW) * 100}%`, top: `${(y(m.whiteWin) / GH) * 100}%`, background: CLASS_COLOR[m.cls] }}
            aria-hidden="true"
          />
        ) : null
      )}
    </div>
  )
}

// ─── Move list with class marks ──────────────────────────────────────────────

const moveNo = (m: ReviewedMove) => Number(m.fenBefore.split(' ')[5]) || 1

export function ReviewMoves({
  moves,
  current,
  onPick,
  keyOnly,
  keyMoments,
}: {
  moves: ReviewedMove[]
  current: number
  onPick: (ply: number) => void
  keyOnly: boolean
  keyMoments: number[]
}) {
  const t = useTranslations('chess.analysis')
  const listRef = useRef<HTMLDivElement>(null)

  // keep the current move in view while stepping with the keyboard
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current, keyOnly])

  const cell = (m: ReviewedMove | undefined, wide = false) =>
    m ? (
      <button
        type="button"
        className={styles.move}
        aria-current={m.ply === current}
        aria-label={t('move_aria', { no: moveNo(m), san: m.san, cls: t(`class_${m.cls}`) })}
        onClick={() => onPick(m.ply)}
      >
        <ClassIcon cls={m.cls} size={15} />
        <span className={styles.san}>{m.san}</span>
        {wide && <span className={styles.moveCls} style={{ color: CLASS_COLOR[m.cls] }}>{t(`class_${m.cls}`)}</span>}
      </button>
    ) : (
      <span />
    )

  if (keyOnly) {
    if (!keyMoments.length) return <p className={styles.muted}>{t('no_key')}</p>
    return (
      <div ref={listRef} className={styles.keyList}>
        {keyMoments.map((p) => (
          <div key={p} className={styles.keyRow}>
            <span className={styles.no}>
              {moveNo(moves[p])}
              {moves[p].color === 'w' ? '.' : '…'}
            </span>
            {cell(moves[p], true)}
          </div>
        ))}
      </div>
    )
  }

  // rows of (white, black); a game that starts with Black to move has an empty first white cell
  const offset = moves[0]?.color === 'b' ? 1 : 0
  const rows = Array.from({ length: Math.ceil((moves.length + offset) / 2) }, (_, r) => [moves[r * 2 - offset], moves[r * 2 + 1 - offset]] as const)
  return (
    <div ref={listRef} className={styles.list}>
      {rows.map(([w, b], r) => (
        <div key={r} className={styles.row}>
          <span className={styles.no}>{moveNo((w ?? b)!)}.</span>
          {cell(w)}
          {cell(b)}
        </div>
      ))}
    </div>
  )
}
