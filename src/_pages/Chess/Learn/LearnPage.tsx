'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Chess } from 'chess.js'
import { ArrowRight, Check, ChessKing, Eye, LogIn, Sparkles } from 'lucide-react'
import { ChessBoard, type BoardArrow } from '@/widgets/Chess/Board'
import { OPENINGS, TACTICS, recommendTactics, tacticSolved, type Opening, type Tactic } from '@/shared/lib/chess/data'
import { useOpeningProgress, type OpeningMark } from './openingProgress'
import styles from './LearnPage.module.scss'

export type LearnTab = 'tactics' | 'openings'
type ByTheme = Record<string, { solved: number }>
type Progress = { byTheme: ByTheme } | 'guest' | null

/** a theme counts as mastered after this many clean solves — the card's bar fills up to it */
const GOAL = 10

/** "1. e4 e5 2. Nf3 Nc6 …" — first `plies` half-moves. */
export function lineText(moves: string[], plies = moves.length) {
  return moves
    .slice(0, plies)
    .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san))
    .join(' ')
}

const sq = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) })

// the idea move is the bright arrow; what it threatens is drawn fainter, in amber
const tacticArrows = (t: Tactic): BoardArrow[] =>
  t.example.arrows.map((a, i) => (i === 0 ? sq(a) : { ...sq(a), color: '#e8892f', opacity: 0.5 }))

// position after each opening's main line (static data — computed once)
const OPENING_END: Record<string, { fen: string; last: { from: string; to: string } }> = Object.fromEntries(
  OPENINGS.map((o) => {
    const g = new Chess()
    for (const san of o.moves) g.move(san)
    const last = g.history({ verbose: true }).at(-1)!
    return [o.id, { fen: g.fen(), last: { from: last.from, to: last.to } }]
  })
)

export function LearnPage({ tab: initialTab = 'tactics' }: { tab?: LearnTab }) {
  const t = useTranslations('chess.learn')
  const [tab, setTab] = useState<LearnTab>(initialTab)
  const [progress, setProgress] = useState<Progress>(null)
  const [marks] = useOpeningProgress()

  useEffect(() => {
    let live = true
    fetch('/api/chess/progress')
      .then((r) => (r.status === 401 ? 'guest' : r.ok ? r.json() : null))
      .then((p) => live && setProgress(p))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const pick = (next: LearnTab) => {
    setTab(next)
    window.history.replaceState(null, '', next === 'tactics' ? '/chess/learn' : '/chess/learn?tab=openings')
  }

  const byTheme = progress && progress !== 'guest' ? (progress.byTheme ?? {}) : null
  const solvedOf = (id: string) => (byTheme ? tacticSolved(id, byTheme) : null)
  const recommended = byTheme ? recommendTactics(byTheme) : []
  const marked = Object.values(marks)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('ln_title')}</h1>

        <div className={styles.seg} role="tablist" aria-label={t('ln_title')}>
          {(['tactics', 'openings'] as const).map((x) => (
            <button key={x} type="button" role="tab" id={`tab-${x}`} aria-selected={tab === x} aria-controls={`panel-${x}`} onClick={() => pick(x)}>
              {t(`ln_tab_${x}`)}
              <span>{x === 'tactics' ? TACTICS.length : OPENINGS.length}</span>
            </button>
          ))}
        </div>

        {tab === 'tactics' ? (
          progress === 'guest' ? (
            <Link href="/login" className={styles.guest}>
              <LogIn size={15} aria-hidden="true" />
              {t('ln_guest')}
            </Link>
          ) : (
            <dl className={styles.stats} aria-busy={!byTheme}>
              <Stat label={t('ln_stat_started')} value={byTheme ? TACTICS.filter((x) => solvedOf(x.id)! > 0).length : '–'} of={TACTICS.length} />
              {/* doubleAttack is a sum of two other themes — counting it would count those puzzles twice */}
              <Stat label={t('ln_stat_solved')} value={byTheme ? TACTICS.filter((x) => x.id !== 'doubleAttack').reduce((n, x) => n + solvedOf(x.id)!, 0) : '–'} />
            </dl>
          )
        ) : (
          <dl className={styles.stats}>
            <Stat label={t('ln_stat_viewed')} value={marked.length} />
            <Stat label={t('ln_stat_done')} value={marked.filter((m) => m === 'done').length} of={OPENINGS.length} />
          </dl>
        )}
      </header>

      <div className={styles.room}>
        {tab === 'tactics' ? (
          <section role="tabpanel" id="panel-tactics" aria-labelledby="tab-tactics">
            <ul className={styles.grid}>
              {TACTICS.map((x) => (
                <li key={x.id}>
                  <TacticCard tactic={x} solved={solvedOf(x.id)} guest={progress === 'guest'} recommended={recommended.includes(x.id)} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section role="tabpanel" id="panel-openings" aria-labelledby="tab-openings" className={styles.groups}>
            {(['w', 'b'] as const).map((side) => {
              const list = OPENINGS.filter((o) => o.side === side)
              return (
                <div key={side}>
                  <h2 className={styles.groupTitle}>
                    <SideMark side={side} />
                    {t(side === 'w' ? 'ln_for_white' : 'ln_for_black')}
                    <span>{list.length}</span>
                  </h2>
                  <ul className={styles.grid}>
                    {list.map((o) => (
                      <li key={o.id}>
                        <OpeningCard opening={o} mark={marks[o.id]} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, of }: { label: string; value: number | string; of?: number }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>
        {value}
        {of != null && <span>/{of}</span>}
      </dd>
    </div>
  )
}

function SideMark({ side }: { side: 'w' | 'b' }) {
  return (
    <span className={styles.side} data-side={side} aria-hidden="true">
      <ChessKing size={14} strokeWidth={2.2} />
    </span>
  )
}

function TacticCard({ tactic, solved, guest, recommended }: { tactic: Tactic; solved: number | null; guest: boolean; recommended: boolean }) {
  const t = useTranslations('chess.learn')
  return (
    <Link href={`/chess/puzzles?mode=theme&theme=${tactic.id}`} className={styles.card} data-recommended={recommended || undefined}>
      <div className={styles.board}>
        <ChessBoard fen={tactic.example.fen} orientation="w" interactive={false} coords={false} effects={false} animate={false} arrows={tacticArrows(tactic)} />
      </div>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{t(tactic.nameKey)}</h3>
          {recommended && (
            <span className={styles.badge}>
              <Sparkles size={12} aria-hidden="true" />
              {t('ln_recommended')}
            </span>
          )}
        </div>
        <p className={styles.gist}>{t(tactic.gistKey)}</p>
        <div className={styles.foot}>
          {guest ? (
            <span className={styles.footText}>{t('ln_train')}</span>
          ) : solved == null ? (
            <span className={styles.footText} />
          ) : solved === 0 ? (
            <span className={styles.pill}>{t('ln_new')}</span>
          ) : (
            <span className={styles.meter} data-full={solved >= GOAL || undefined}>
              <span className={styles.bar} aria-hidden="true">
                <span style={{ width: `${Math.min(100, (solved / GOAL) * 100)}%` }} />
              </span>
              <span className={styles.footText}>{solved >= GOAL ? t('ln_mastered', { n: solved }) : t('ln_progress', { n: solved, goal: GOAL })}</span>
            </span>
          )}
          <ArrowRight className={styles.go} size={16} aria-hidden="true" />
        </div>
      </div>
    </Link>
  )
}

function OpeningCard({ opening, mark }: { opening: Opening; mark?: OpeningMark }) {
  const t = useTranslations('chess.learn')
  const end = OPENING_END[opening.id]
  return (
    <Link href={`/chess/learn/opening/${opening.id}`} className={styles.card}>
      <div className={styles.board}>
        <ChessBoard fen={end.fen} orientation={opening.side} interactive={false} coords={false} effects={false} animate={false} lastMove={end.last} />
      </div>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{t(opening.nameKey)}</h3>
          <span className={styles.eco}>{opening.eco}</span>
        </div>
        <p className={styles.gist} title={lineText(opening.moves)}>
          {lineText(opening.moves, 6)}
        </p>
        <div className={styles.foot}>
          <span className={styles.sideText} title={t(opening.side === 'w' ? 'ln_side_w' : 'ln_side_b')}>
            <SideMark side={opening.side} />
            <span className={styles.srOnly}>{t(opening.side === 'w' ? 'ln_side_w' : 'ln_side_b')}</span>
            {t('ln_moves', { n: Math.ceil(opening.moves.length / 2) })}
          </span>
          {mark ? (
            <span className={styles.pill} data-mark={mark}>
              {mark === 'done' ? <Check size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
              {t(mark === 'done' ? 'ln_mark_done' : 'ln_mark_viewed')}
            </span>
          ) : (
            <span className={styles.pill}>{t('ln_new_opening')}</span>
          )}
          <ArrowRight className={styles.go} size={16} aria-hidden="true" />
        </div>
      </div>
    </Link>
  )
}
