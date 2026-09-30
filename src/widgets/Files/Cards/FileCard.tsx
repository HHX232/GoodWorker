'use client'

import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useLocale, useTranslations } from 'next-intl'
import type { CSSProperties, ReactNode } from 'react'
import { CardMenu, type CardMenuItem } from '../CardMenu/CardMenu'
import { FilesDeleteIcon, FilesDownloadIcon, FilesEditIcon, FilesLectureIcon, FilesPlayIcon, FilesPreviewIcon, FilesReviewIcon, FilesShareIcon, FilesTestIcon, FilesTextSearchIcon } from '../icons'
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
  /** Tutor: check a student submission (idea 1) — only passed for student uploads. */
  onReview?: () => void
  /** Tutor: edit this docx in the browser — only passed for docx files. */
  onEdit?: () => void
  /** Tutor: open the PDF → test importer with this file (idea 3). */
  onMakeTest?: () => void
  /** Search: the passage where the query was found inside the file (idea 8). */
  contentMatch?: string | null
  query?: string
  /** Saved /lecture notes: a type of its own — notebook cover, a "Конспект" flag, opens the lecture editor. */
  lecture?: { onOpen: () => void }
}

/** The query highlighted inside a search snippet — case-insensitive, every occurrence. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{text}</>
  const parts: ReactNode[] = []
  const lower = text.toLowerCase()
  let from = 0
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, from)) {
    if (i > from) parts.push(text.slice(from, i))
    parts.push(<mark key={i}>{text.slice(i, i + q.length)}</mark>)
    from = i + q.length
  }
  parts.push(text.slice(from))
  return <>{parts}</>
}

/** Floe workflow-card shape: artwork on top, a white panel riding up over it. */
export function FileCard({ file, onPreview, onDownload, onShare, onDelete, hint, onReview, onEdit, onMakeTest, contentMatch, query = '', lecture }: FileCardProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const kind = fileKind(file.mimeType, file.name)
  const Icon = KIND_ICON[kind]
  const viewable = viewerFor(file.mimeType, file.name) !== null
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase().slice(0, 4) : kind.toUpperCase()

  const items: CardMenuItem[] = []
  if (lecture) items.push({ label: t('lectureContinue'), icon: FilesLectureIcon, onSelect: lecture.onOpen })
  else if (viewable) items.push({ label: t('open'), icon: FilesPreviewIcon, onSelect: onPreview })
  items.push({ label: t('download'), icon: FilesDownloadIcon, onSelect: onDownload })
  if (onReview) items.push({ label: file.review ? t('reviewEdit') : t('review'), icon: FilesReviewIcon, onSelect: onReview })
  if (onEdit) items.push({ label: t('editDocx'), icon: FilesEditIcon, onSelect: onEdit })
  if (onMakeTest) items.push({ label: t('makeTest'), icon: FilesTestIcon, onSelect: onMakeTest })
  if (onShare) items.push({ label: t('share'), icon: FilesShareIcon, onSelect: onShare })
  if (onDelete) items.push({ label: t('delete'), icon: FilesDeleteIcon, onSelect: onDelete, danger: true })

  return (
    <div className={`${styles.fileCard} ${lecture ? styles.lectureCard : ''}`} style={{ '--kind': lecture ? '#7c3aed' : KIND_COLOR[kind] } as CSSProperties}>
      <button
        type="button"
        className={styles.hit}
        onClick={lecture ? lecture.onOpen : viewable ? onPreview : onDownload}
        aria-label={`${lecture ? t('lectureContinue') : viewable ? t('open') : t('download')}: ${file.name}`}
      />
      {lecture ? (
        <div className={`${styles.art} ${styles.artLecture}`} aria-hidden>
          <span className={styles.lectureSheet}>
            <span className={styles.lectureSheetIcon}><FilesLectureIcon size={20} strokeWidth={1.8} /></span>
            <span className={styles.lectureLine} style={{ width: '78%' }} />
            <span className={styles.lectureLine} style={{ width: '62%' }} />
            <span className={styles.lectureFormula}>∫ f(x) dx</span>
            <span className={styles.lectureLine} style={{ width: '70%' }} />
          </span>
        </div>
      ) : (
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
      )}
      <div className={styles.panel}>
        <div className={styles.panelTop}>
          <span className={styles.meta}>{formatDate(file.createdAt, locale)} · {formatBytes(file.sizeBytes, locale)}</span>
          <CardMenu items={items} label={t('actions')} />
        </div>
        <div className={styles.fileName} title={file.name}>
          <span className={styles.nameIcon}>{lecture ? <FilesLectureIcon size={15} strokeWidth={2} /> : <Icon size={15} strokeWidth={2} />}</span>
          <span className={styles.nameText}>{file.name}</span>
        </div>
        {hint && <div className={styles.fileHint} title={hint}>{hint}</div>}
        {contentMatch && (
          <div className={styles.contentMatch}>
            <span className={styles.contentMatchLabel}><FilesTextSearchIcon size={11} /> {t('foundInside')}</span>
            <span className={styles.contentMatchText}><Highlighted text={contentMatch} query={query} /></span>
          </div>
        )}
        <div className={styles.fileFoot}>
          <AvatarStack people={file.sharedWith} />
          <span className={styles.spacer} />
          {file.late && <span className={`${styles.chip} ${styles.chipLate}`}>{t('late')}</span>}
          {file.review
            ? <span className={`${styles.chip} ${file.review.status === 'ACCEPTED' ? '' : styles.chipRevision}`} title={file.review.comment ?? undefined}>
                {file.review.status === 'ACCEPTED' ? t('reviewAccepted') : t('reviewRevision')}{file.review.grade ? ` · ${file.review.grade}` : ''}
              </span>
            : file.uploadedByRole === 'STUDENT' && <span className={styles.chip}>{t('uploadedByStudent')}</span>}
          {lecture
            ? <button type="button" className={styles.lectureFlag} onClick={e => { e.stopPropagation(); lecture.onOpen() }}><FilesLectureIcon size={11} strokeWidth={2.2} /> {t('lectureFlag')}</button>
            : <span className={styles.extChip}>{ext}</span>}
        </div>
      </div>
    </div>
  )
}
