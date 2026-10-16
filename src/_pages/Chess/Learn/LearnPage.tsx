'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check, Eye, LogIn } from 'lucide-react'
import { OPENINGS, TACTICS, tacticSolved, type Opening } from '@/shared/lib/chess/data'
import { useOpeningProgress } from './openingProgress'
import styles from './Learn.module.scss'

export type LearnTab = 'tactics' | 'openings'
type Progress = { byTheme: Record<string, { solved: number }> } | 'guest' | null

/** "1. e4 e5 2. Nf3 Nc6 …" — first `plies` half-moves. */
export function lineText(moves: string[], plies = moves.length) {
  return moves
    .slice(0, plies)
    .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san))
    .join(' ')
}

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

  const group = (side: 'w' | 'b') => OPENINGS.filter((o) => o.side === side)

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('ln_title')}</h1>
          <p className={styles.lede}>{t('ln_lede')}</p>
        </header>

        <div className={styles.tabs} role="tablist" aria-label={t('ln_title')}>
          {(['tactics', 'openings'] as const).map((x) => (
            <button key={x} type="button" role="tab" id={`tab-${x}`} aria-selected={tab === x} aria-controls={`panel-${x}`} className={styles.tab} onClick={() => pick(x)}>
              {t(`ln_tab_${x}`)}
              <span className={styles.tabCount}>{x === 'tactics' ? TACTICS.length : OPENINGS.length}</span>
            </button>
          ))}
        </div>

        {tab === 'tactics' ? (
          <section role="tabpanel" id="panel-tactics" aria-labelledby="tab-tactics">
            {progress === 'guest' && (
              <Link href="/login" className={styles.guest}>
                <LogIn size={16} aria-hidden="true" />
                {t('ln_guest')}
              </Link>
            )}
            <ol className={styles.tactics}>
              {TACTICS.map((x) => {
                const solved = progress && progress !== 'guest' ? tacticSolved(x.id, progress.byTheme ?? {}) : null
                return (
                  <li key={x.id} className={styles.tactic}>
                    <div className={styles.tacticText}>
                      <h2 className={styles.tacticName}>{t(x.nameKey)}</h2>
                      <p className={styles.tacticDesc}>{t(x.descKey)}</p>
                    </div>
                    <div className={styles.tacticAside}>
                      {solved != null && (
                        <span className={styles.solved} data-zero={solved === 0 || undefined}>
                          {t('ln_solved', { n: solved })}
                        </span>
                      )}
                      <Link href={`/chess/puzzles?mode=theme&theme=${x.id}`} className={styles.train}>
                        {t('ln_train')}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : (
          <section role="tabpanel" id="panel-openings" aria-labelledby="tab-openings" className={styles.openingGroups}>
            {(['w', 'b'] as const).map((side) => (
              <div key={side}>
                <h2 className={styles.groupTitle}>{t(side === 'w' ? 'ln_for_white' : 'ln_for_black')}</h2>
                <ul className={styles.openings}>
                  {group(side).map((o: Opening) => (
                    <li key={o.id}>
                      <Link href={`/chess/learn/opening/${o.id}`} className={styles.opening}>
                        <span className={styles.eco}>{o.eco}</span>
                        <span className={styles.openingName}>{t(o.nameKey)}</span>
                        <span className={styles.openingLine}>{lineText(o.moves, 6)}</span>
                        {marks[o.id] && (
                          <span className={styles.mark} data-mark={marks[o.id]}>
                            {marks[o.id] === 'done' ? <Check size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                            {t(marks[o.id] === 'done' ? 'ln_mark_done' : 'ln_mark_viewed')}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
