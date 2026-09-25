'use client'

import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useLocale, useTranslations } from 'next-intl'
import type { CSSProperties } from 'react'
import { CardMenu, type CardMenuItem } from '../CardMenu/CardMenu'
import { FilesDeleteIcon, FilesDownloadIcon, FilesPlayIcon, FilesPreviewIcon, FilesShareIcon } from '../icons'
import { fileKind, formatBytes, formatDate, KIND_COLOR, KIND_ICON, viewerFor } from '../lib'
import { AvatarStack } from './AvatarStack'
import styles from './Cards.module.scss'

export interface FileCardProps {
  file: LibraryFile
  /** Opens the in-app viewer (only called for types that have one). */
  onPreview: () => void
  onDownload: () => void
  onShare?: () => void
  onDelete?: () => void
  hint?: string
}

/** Floe workflow-card shape: artwork on top, a white panel riding up over it. */
export function FileCard({ file, onPreview, onDownload, onShare, onDelete, hint }: FileCardProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const kind = fileKind(file.mimeType, file.name)
  const Icon = KIND_ICON[kind]
  const viewable = viewerFor(file.mimeType, file.name) !== null
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase().slice(0, 4) : kind.toUpperCase()

  const items: CardMenuItem[] = []
  if (viewable) items.push({ label: t('open'), icon: FilesPreviewIcon, onSelect: onPreview })
  items.push({ label: t('download'), icon: FilesDownloadIcon, onSelect: onDownload })
  if (onShare) items.push({ label: t('share'), icon: FilesShareIcon, onSelect: onShare })
  if (onDelete) items.push({ label: t('delete'), icon: FilesDeleteIcon, onSelect: onDelete, danger: true })

  return (
    <div className={styles.fileCard} style={{ '--kind': KIND_COLOR[kind] } as CSSProperties}>
      <button
        type="button"
        className={styles.hit}
        onClick={viewable ? onPreview : onDownload}
        aria-label={`${viewable ? t('open') : t('download')}: ${file.name}`}
      />
      <div className={styles.art}>
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" loading="lazy" className={styles.artImg} />
        )}
        {kind === 'video' && (
          // First frame as the thumbnail; the player itself lives in the viewer.
          <video src={`${file.url}#t=0.1`} preload="metadata" muted playsInline className={styles.artImg} />
        )}
        {kind !== 'image' && kind !== 'video' && <Icon size={34} strokeWidth={1.4} />}
        {(kind === 'video' || kind === 'audio') && <span className={`${styles.play} ${kind === 'audio' ? styles.playCorner : ''}`}><FilesPlayIcon size={16} /></span>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTop}>
          <span className={styles.meta}>{formatDate(file.createdAt, locale)} · {formatBytes(file.sizeBytes, locale)}</span>
          <CardMenu items={items} label={t('actions')} />
        </div>
        <div className={styles.fileName} title={file.name}>
          <span className={styles.nameIcon}><Icon size={15} strokeWidth={2} /></span>
          <span className={styles.nameText}>{file.name}</span>
        </div>
        {hint && <div className={styles.fileHint} title={hint}>{hint}</div>}
        <div className={styles.fileFoot}>
          <AvatarStack people={file.sharedWith} />
          <span className={styles.spacer} />
          {file.uploadedByRole === 'STUDENT' && <span className={styles.chip}>{t('uploadedByStudent')}</span>}
          <span className={styles.extChip}>{ext}</span>
        </div>
      </div>
    </div>
  )
}
