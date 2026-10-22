'use client'

import type { BookPresencePage } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useId } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate, initials } from '../lib'
import type { Corner } from './spread'
import styles from './BookReader.module.scss'

const MAX_AVATARS = 3

/** "5 окт, 21:14": the shared date helper plus the time; '' (never a raw ISO) when the value is unusable. */
function whenLabel(iso: string, locale: string): string {
  const date = formatDate(iso, locale)
  const d = new Date(iso)
  if (!date || Number.isNaN(d.getTime())) return ''
  try {
    return `${date}, ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return date
  }
}

/**
 * Tutor-only corner badge on the page a student stopped at: their avatars
 * (+N past three); hover/focus opens who stopped here and who read this page
 * earlier. `corner` is chosen by spread.ts (double → page side, single → left).
 */
export function ReaderMark({ page, entry, corner }: { page: number; entry: BookPresencePage; corner: Corner }) {
  const t = useTranslations('files')
  const locale = useLocale()
  const popId = useId()
  const people = entry.stoppedHere
  if (people.length === 0) return null
  const shown = people.slice(0, MAX_AVATARS)
  const rest = people.length - shown.length
  // A student who stopped here is listed once, as "stopped here" — not again as "read".
  const stopped = new Set(people.map(p => p.id))
  const earlier = entry.readBy.filter(r => !stopped.has(r.person.id))
  return (
    <div className={`${styles.mark} ${corner === 'right' ? styles.markRight : styles.markLeft}`} data-corner={corner} data-mark-page={page}>
      <button type="button" className={styles.markBtn} aria-describedby={popId} aria-label={t('booksReaderMarkAria', { page, names: people.map(p => p.name).join(', ') })}>
        {shown.map(p => (
          <span key={p.id} className={styles.markAvatar}>
            {p.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.avatarUrl} alt="" />
              : initials(p.name)}
          </span>
        ))}
        {rest > 0 && <span className={`${styles.markAvatar} ${styles.markMore}`}>+{rest}</span>}
      </button>
      {/* Hidden (display:none) until hover/focus, but aria-describedby still exposes all of it to a screen reader. */}
      <div id={popId} className={styles.markPop} role="tooltip">
        {people.map(p => {
          const when = whenLabel(p.stoppedAt, locale)
          return (
            <div key={p.id} className={styles.popRow}>
              <span className={styles.popName}>{p.name}</span>
              <span className={styles.popNow}>{t('booksReaderStoppedHere')}{when && ` · ${when}`}</span>
            </div>
          )
        })}
        {earlier.map(r => (
          <div key={r.person.id} className={styles.popRow}>
            <span className={styles.popName}>{r.person.name}</span>
            <span className={styles.popPast}>{t('booksReaderReadAt', { date: whenLabel(r.lastReadAt, locale) })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
