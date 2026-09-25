'use client'

import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useLocale, useTranslations } from 'next-intl'
import { CardMenu, type CardMenuItem } from '../CardMenu/CardMenu'
import { FilesDeleteIcon, FilesDownloadIcon, FilesPreviewIcon, FilesShareIcon } from '../icons'
import { fileKind, formatBytes, formatDate, isPreviewable, KIND_ICON } from '../lib'
import { AvatarStack } from './AvatarStack'
import styles from './Cards.module.scss'

export interface FileCardProps {
  file: LibraryFile
  /** PDF/image → preview; anything else → download. */
  onPreview: () => void
  onShare?: () => void
  onDelete?: () => void
  hint?: string
}

function download(file: LibraryFile) {
  const a = document.createElement('a')
  a.href = file.url
  a.download = file.name
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.click()
}

/** Floe workflow-card shape: artwork on top, a white panel riding up over it. */
export function FileCard({ file, onPreview, onShare, onDelete, hint }: FileCardProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const kind = fileKind(file.mimeType, file.name)
  const Icon = KIND_ICON[kind]
  const previewable = isPreviewable(kind)
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase().slice(0, 4) : kind.toUpperCase()

  const items: CardMenuItem[] = []
  if (previewable) items.push({ label: t('open'), icon: FilesPreviewIcon, onSelect: onPreview })
  items.push({ label: t('download'), icon: FilesDownloadIcon, onSelect: () => download(file) })
  if (onShare) items.push({ label: t('share'), icon: FilesShareIcon, onSelect: onShare })
  if (onDelete) items.push({ label: t('delete'), icon: FilesDeleteIcon, onSelect: onDelete, danger: true })

  return (
    <div className={styles.fileCard}>
      <button
        type="button"
        className={styles.hit}
        onClick={previewable ? onPreview : () => download(file)}
        aria-label={`${previewable ? t('open') : t('download')}: ${file.name}`}
      />
      <div className={`${styles.art} ${styles[kind]}`}>
        {kind === 'image'
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={file.url} alt="" loading="lazy" className={styles.artImg} />
          : <Icon size={34} strokeWidth={1.4} />}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTop}>
          <span className={styles.meta}>{formatDate(file.createdAt, locale)} · {formatBytes(file.sizeBytes, locale)}</span>
          <CardMenu items={items} label={t('actions')} />
        </div>
        <div className={styles.fileName} title={file.name}>{file.name}</div>
        {hint && <div className={styles.fileHint} title={hint}>{hint}</div>}
        <div className={styles.fileFoot}>
          <AvatarStack people={file.sharedWith} />
          <span className={styles.spacer} />
          {file.uploadedByRole === 'STUDENT' && <span className={styles.chip}>{t('uploadedByStudent')}</span>}
          <span className={`${styles.extChip} ${styles[kind]}`}>{ext}</span>
        </div>
      </div>
    </div>
  )
}
