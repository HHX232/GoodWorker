'use client'

import type { LibraryResponse, UsageResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { FilesFolderOpenIcon, FilesStorageIcon } from '../icons'
import { filesFetch, formatBytes } from '../lib'
import styles from './StorageStat.module.scss'

/** Tutor dashboard strip: how much of the library is used, highlighted, → /files. */
export function TeacherStorageStat() {
  const t = useTranslations('files')
  const locale = useLocale()
  const { data } = useQuery({
    queryKey: ['tutor-files', 'usage'],
    queryFn: () => filesFetch<UsageResponse>('/api/tutor-files/usage'),
    staleTime: 60_000,
  })
  const pct = data ? Math.min(100, (data.usedBytes / data.quotaBytes) * 100) : 0
  return (
    <Link href="/files" className={styles.stat} aria-label={t('pageTitle')}>
      <span className={styles.icon}><FilesStorageIcon size={15} strokeWidth={2} /></span>
      <span className={styles.body}>
        <span className={styles.value}>{data ? formatBytes(data.usedBytes, locale) : '—'}</span>
        <span className={styles.label}>{t('statStorage')}{data ? ` · ${formatBytes(data.quotaBytes, locale)}` : ''}</span>
        <span className={styles.bar}><span style={{ width: `${pct}%` }} className={pct >= 90 ? styles.barWarn : ''} /></span>
      </span>
    </Link>
  )
}

/** Student dashboard strip: how many folders/files tutors have shared, highlighted, → /files. */
export function StudentFilesStat({ className }: { className?: string }) {
  const t = useTranslations('files')
  const { data } = useQuery({
    queryKey: ['tutor-files', 'library', null],
    queryFn: () => filesFetch<LibraryResponse>('/api/tutor-files/library'),
    staleTime: 60_000,
  })
  const count = data ? data.groups.reduce((n, g) => n + g.folders.length + g.files.length, 0) : null
  return (
    <Link href="/files" className={`${styles.stat} ${styles.studentStat} ${className ?? ''}`} aria-label={t('pageTitle')}>
      <span className={styles.icon}><FilesFolderOpenIcon size={15} strokeWidth={2} /></span>
      <span className={styles.body}>
        <span className={styles.value}>{count ?? '—'}</span>
        <span className={styles.label}>{t('statShared')}</span>
      </span>
    </Link>
  )
}
