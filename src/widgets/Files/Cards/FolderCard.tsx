'use client'

import type { LibraryFolder } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import { FilesDeleteIcon, FilesDropboxIcon, FilesFolderIcon, FilesPersonalFolderIcon, FilesRenameIcon, FilesShareIcon } from '../icons'
import { AvatarStack } from './AvatarStack'
import styles from './Cards.module.scss'

export interface FolderCardProps {
  folder: LibraryFolder
  onOpen: () => void
  /** Teacher-only actions; omitted for the student view. */
  onShare?: () => void
  onRename?: () => void
  onDelete?: () => void
  /** Small grey line under the name (search results: the folder's path). */
  hint?: string
}

export function FolderCard({ folder, onOpen, onShare, onRename, onDelete, hint }: FolderCardProps) {
  const t = useTranslations('files')
  const personal = !!folder.restrictedToStudentId
  const Icon = personal ? FilesPersonalFolderIcon : folder.allowStudentUpload ? FilesDropboxIcon : FilesFolderIcon
  const hasActions = !!(onShare || onRename || onDelete)

  return (
    <div className={`${styles.card} ${styles.folder} ${personal ? styles.personal : ''}`}>
      <button type="button" className={styles.hit} onClick={onOpen} aria-label={`${t('open')}: ${folder.name}`} />
      <div className={styles.top}>
        <span className={styles.folderTile}><Icon size={20} strokeWidth={1.8} /></span>
        {hasActions && (
          <span className={styles.actions}>
            {onShare && !personal && (
              <button type="button" className={styles.action} onClick={onShare} aria-label={t('share')} title={t('share')}><FilesShareIcon size={15} /></button>
            )}
            {onRename && (
              <button type="button" className={styles.action} onClick={onRename} aria-label={t('rename')} title={t('rename')}><FilesRenameIcon size={15} /></button>
            )}
            {onDelete && (
              <button type="button" className={`${styles.action} ${styles.actionDanger}`} onClick={onDelete} aria-label={t('delete')} title={t('delete')}><FilesDeleteIcon size={15} /></button>
            )}
          </span>
        )}
      </div>
      <div className={styles.name} title={folder.name}>{folder.name}</div>
      {hint && <div className={styles.hint} title={hint}>{hint}</div>}
      <div className={styles.meta}>
        <span className={styles.count}>{t('itemsCount', { count: folder.itemCount })}</span>
        {personal && <span className={`${styles.badge} ${styles.badgePersonal}`}>{t('badgePersonal')}</span>}
        {!personal && folder.allowStudentUpload && <span className={styles.badge}>{t('badgeDropbox')}</span>}
        <span className={styles.spacer} />
        <AvatarStack people={folder.sharedWith} />
      </div>
    </div>
  )
}
