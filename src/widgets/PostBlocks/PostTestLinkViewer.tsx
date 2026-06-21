'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PostTestLinkEntry } from '@/shared/types/Post/Post.type'
import styles from './PostTestLinkViewer.module.scss'

interface Props {
  tests: PostTestLinkEntry[]
  theme?: 'purple' | 'green'
}

function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

export function PostTestLinkViewer({ tests, theme = 'purple' }: Props) {
  const t = useTranslations('PostPage')

  if (!tests.length) return null

  const cls = theme === 'green' ? styles.wrap_green : styles.wrap_purple

  return (
    <div className={`${styles.wrap} ${cls}`}>
      <div className={styles.header}>
        <span className={styles.badge}>
          <IconClipboard />
          {t('testLinkBadge')}
        </span>
        {tests.length > 1 && (
          <span className={styles.count}>{tests.length}</span>
        )}
      </div>

      <div className={styles.list}>
        {tests.map((test) => (
          <Link key={test.id} href={`/test/${test.id}`} className={styles.card}>
            <div className={styles.card_icon}>
              <IconClipboard />
            </div>
            <div className={styles.card_body}>
              <span className={styles.card_title}>{test.title || t('testLinkDefaultTitle')}</span>
              <span className={styles.card_hint}>{t('testLinkHint')}</span>
            </div>
            <div className={styles.card_arrow}>
              <IconArrow />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
