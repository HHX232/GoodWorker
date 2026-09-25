'use client'

import type { FilesPerson } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useLocale, useTranslations } from 'next-intl'
import { initials } from '../lib'
import styles from './AvatarStack.module.scss'

function openedLabel(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

/**
 * Floe-style overlapping avatars of the students who hold access (up to
 * `max`, then `+N`). In the tutor's view each avatar carries a status dot —
 * green once the student has opened the item — and hovering/focusing it
 * shows the name and when it was first opened.
 */
export function AvatarStack({ people, max = 3 }: { people: FilesPerson[]; max?: number }) {
  const t = useTranslations('files')
  const locale = useLocale()
  if (people.length === 0) return null
  const shown = people.slice(0, max)
  const rest = people.slice(max)
  const tracked = people.some(p => p.firstOpenedAt !== undefined)
  const openedCount = people.filter(p => p.firstOpenedAt).length

  return (
    <span className={styles.stack} aria-label={tracked ? t('openedSummary', { opened: openedCount, total: people.length }) : undefined}>
      {shown.map(p => {
        const status = p.firstOpenedAt === undefined ? null : p.firstOpenedAt ? t('openedAt', { date: openedLabel(p.firstOpenedAt, locale) }) : t('notOpened')
        return (
          <span key={p.id} className={styles.item} tabIndex={status ? 0 : -1}>
            {p.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.avatarUrl} alt="" className={styles.avatar} />
              : <span className={styles.avatar}>{initials(p.name)}</span>}
            {status && <span className={`${styles.dot} ${p.firstOpenedAt ? styles.dotOpened : ''}`} aria-hidden="true" />}
            <span className={styles.tip} role="tooltip">
              <span className={styles.tipName}>{p.name}</span>
              {status && <span className={`${styles.tipStatus} ${p.firstOpenedAt ? styles.tipOpened : ''}`}>{status}</span>}
            </span>
          </span>
        )
      })}
      {rest.length > 0 && (
        <span className={styles.item} tabIndex={0}>
          <span className={`${styles.avatar} ${styles.more}`}>+{rest.length}</span>
          <span className={styles.tip} role="tooltip">
            {rest.map(p => (
              <span key={p.id} className={styles.tipLine}>
                {p.name}
                {p.firstOpenedAt !== undefined && <span className={p.firstOpenedAt ? styles.tipOpened : styles.tipStatus}> · {p.firstOpenedAt ? openedLabel(p.firstOpenedAt, locale) : t('notOpened')}</span>}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  )
}
