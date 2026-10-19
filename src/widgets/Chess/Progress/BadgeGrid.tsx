'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { BADGE_CODES } from '@/shared/lib/chess/server/progressModel'
import { BadgeMedal } from './BadgeMedal'
import { BADGE_GROUPS, badgeText, codesOf } from './badges'
import styles from './Progress.module.scss'

/** Все значки по группам: полученные — с датой, закрытые — с подсказкой, как получить. */
export function BadgeGrid({ earned }: { earned: { code: string; earnedAt: string }[] }) {
  const t = useTranslations('chess.progress')
  const format = useFormatter()
  const at = new Map(earned.map((b) => [b.code, b.earnedAt]))
  return (
    <section className={styles.badges} aria-labelledby="chess-badges-title">
      <header className={styles.badgesHead}>
        <h2 id="chess-badges-title">{t('badges_title')}</h2>
        <span className={styles.badgesCount}>{t('badges_count', { earned: BADGE_CODES.filter((c) => at.has(c)).length, total: BADGE_CODES.length })}</span>
      </header>
      {BADGE_GROUPS.map((g) => (
        <div key={g} className={styles.group}>
          <h3 className={styles.groupTitle}>{t(`group_${g}`)}</h3>
          <ul className={styles.medals}>
            {codesOf(g).map((code) => {
              const { nameKey, hintKey, values } = badgeText(code)
              const when = at.get(code)
              return (
                <li key={code} className={styles.badge} data-earned={!!when || undefined}>
                  <BadgeMedal group={g} n={values.n} earned={!!when} />
                  <span className={styles.badgeName}>{t(nameKey, values)}</span>
                  <span className={styles.badgeMeta}>
                    {when ? t('badge_earned', { date: format.dateTime(new Date(when), { day: 'numeric', month: 'short', year: 'numeric' }) }) : t(hintKey, values)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
