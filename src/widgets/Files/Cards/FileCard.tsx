'use client'

import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useLocale, useTranslations } from 'next-intl'
import { FilesDeleteIcon, FilesDownloadIcon, FilesShareIcon } from '../icons'
import { fileKind, formatBytes, formatDate, isPreviewable, KIND_ICON } from '../lib'
import { AvatarStack } from './AvatarStack'
import styles from './Cards.module.scss'

export interface FileCardProps {
  file: LibraryFile
  /** PDF/image → preview; anything else → the card is a download link instead. */
  onPreview: () => void
  onShare?: () => void
  onDelete?: () => void
  hint?: string
}

export function FileCard({ file, onPreview, onShare, onDelete, hint }: FileCardProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const kind = fileKind(file.mimeType, file.name)
  const Icon = KIND_ICON[kind]
  const previewable = isPreviewable(kind)

  return (
    <div className={`${styles.card} ${styles.file}`}>
      {previewable
        ? <button type="button" className={styles.hit} onClick={onPreview} aria-label={`${t('open')}: ${file.name}`} />
        : <a className={styles.hit} href={file.url} target="_blank" rel="noopener noreferrer" download={file.name} aria-label={`${t('download')}: ${file.name}`} />}
      <div className={`${styles.thumb} ${styles[kind]}`}>
        {kind === 'image'
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={file.url} alt="" loading="lazy" className={styles.thumbImg} />
          : <Icon size={26} strokeWidth={1.6} />}
        <span className={styles.actions}>
          <a className={styles.action} href={file.url} target="_blank" rel="noopener noreferrer" download={file.name} aria-label={t('download')} title={t('download')}>
            <FilesDownloadIcon size={15} />
          </a>
          {onShare && (
            <button type="button" className={styles.action} onClick={onShare} aria-label={t('share')} title={t('share')}><FilesShareIcon size={15} /></button>
          )}
          {onDelete && (
            <button type="button" className={`${styles.action} ${styles.actionDanger}`} onClick={onDelete} aria-label={t('delete')} title={t('delete')}><FilesDeleteIcon size={15} /></button>
          )}
        </span>
      </div>
      <div className={styles.name} title={file.name}>{file.name}</div>
      {hint && <div className={styles.hint} title={hint}>{hint}</div>}
      <div className={styles.meta}>
        <span className={styles.count}>{formatBytes(file.sizeBytes, locale)} · {formatDate(file.createdAt, locale)}</span>
        {file.uploadedByRole === 'STUDENT' && <span className={styles.badge}>{t('uploadedByStudent')}</span>}
        <span className={styles.spacer} />
        <AvatarStack people={file.sharedWith} />
      </div>
    </div>
  )
}
