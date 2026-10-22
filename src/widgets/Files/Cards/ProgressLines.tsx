'use client'

import type { SubmissionProgress } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import styles from './ProgressLines.module.scss'

/**
 * Homework-folder progress as three pill segments (Classes-dashboard style):
 * green = submitted and accepted, amber = waiting for review or being redone,
 * grey = not started. Hover/focus opens the full breakdown plus the folder's
 * total item count (which no longer sits on the card face).
 */
export function ProgressLines({ progress, itemCount }: { progress: SubmissionProgress; itemCount: number }) {
  const t = useTranslations('files')
  const { done, waiting, working, notStarted, total } = progress
  const active = waiting + working
  const empty = total === 0
  const rows: { key: string; label: string; count: number; tone: string }[] = [
    { key: 'done', label: t('progressDone'), count: done, tone: styles.done },
    { key: 'waiting', label: t('progressWaiting'), count: waiting, tone: styles.active },
    { key: 'working', label: t('progressWorking'), count: working, tone: styles.active },
    ...(progress.unit === 'students' ? [{ key: 'idle', label: t('progressNotStarted'), count: notStarted, tone: styles.idle }] : []),
  ]
  const summary = empty ? t('progressNothing') : rows.map(r => `${r.label}: ${r.count}`).join(', ')

  return (
    <span className={styles.wrap} tabIndex={0} aria-label={`${summary}. ${t('progressTotalItems', { count: itemCount })}`}>
      <span className={styles.bar} aria-hidden="true">
        {empty ? <span className={`${styles.seg} ${styles.idle}`} style={{ flexGrow: 1 }} /> : (
          <>
            {done > 0 && <span className={`${styles.seg} ${styles.done}`} style={{ flexGrow: done }} />}
            {active > 0 && <span className={`${styles.seg} ${styles.active}`} style={{ flexGrow: active }} />}
            {notStarted > 0 && <span className={`${styles.seg} ${styles.idle}`} style={{ flexGrow: notStarted }} />}
          </>
        )}
      </span>
      <span className={styles.tip} role="tooltip">
        <span className={styles.tipTitle}>{progress.unit === 'students' ? t('progressByStudents') : t('progressByFiles')}</span>
        {empty
          ? <span className={styles.tipMuted}>{t('progressNothing')}</span>
          : rows.map(r => (
            <span key={r.key} className={styles.row}>
              <span className={`${styles.dot} ${r.tone}`} aria-hidden="true" />
              <span className={styles.label}>{r.label}</span>
              <span className={styles.count}>{r.count}</span>
            </span>
          ))}
        <span className={styles.tipFoot}>{t('progressTotalItems', { count: itemCount })}</span>
      </span>
    </span>
  )
}
