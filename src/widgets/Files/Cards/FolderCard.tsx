'use client'

import type { LibraryFolder } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import { CardMenu, type CardMenuItem } from '../CardMenu/CardMenu'
import { FilesCoverIcon, FilesDeleteIcon, FilesPlusIcon, FilesRenameIcon, FilesShareIcon } from '../icons'
import { AvatarStack } from './AvatarStack'
import styles from './Cards.module.scss'
import { FolderShape } from './FolderShape'

export interface FolderCardProps {
  folder: LibraryFolder
  onOpen: () => void
  /** Teacher-only actions; omitted for the student view. */
  onShare?: () => void
  onCover?: () => void
  onRename?: () => void
  onDelete?: () => void
  /** Small line under the name (search results: the folder's path). */
  hint?: string
}

export function FolderCard({ folder, onOpen, onShare, onCover, onRename, onDelete, hint }: FolderCardProps) {
  const t = useTranslations('files')
  const personal = !!folder.restrictedToStudentId
  const items: CardMenuItem[] = []
  if (onShare && !personal) items.push({ label: t('share'), icon: FilesShareIcon, onSelect: onShare })
  if (onCover) items.push({ label: t('cover'), icon: FilesCoverIcon, onSelect: onCover })
  if (onRename) items.push({ label: t('rename'), icon: FilesRenameIcon, onSelect: onRename })
  if (onDelete) items.push({ label: t('delete'), icon: FilesDeleteIcon, onSelect: onDelete, danger: true })

  return (
    <div className={styles.folderCard}>
      <FolderShape folderId={folder.id} cover={folder.cover}>
        <button type="button" className={styles.hit} onClick={onOpen} aria-label={`${t('open')}: ${folder.name}`} />
        <div className={styles.folderTop}>
          <span className={styles.badges}>
            {personal && <span className={styles.badge}>{t('badgePersonal')}</span>}
            {!personal && folder.allowStudentUpload && <span className={styles.badge}>{t('badgeDropbox')}</span>}
          </span>
          <CardMenu items={items} label={t('actions')} />
        </div>
        <div className={styles.folderName} title={folder.name}>{folder.name}</div>
        {hint && <div className={styles.folderHint} title={hint}>{hint}</div>}
        <div className={styles.folderFoot}>
          <AvatarStack people={folder.sharedWith} />
          <span className={styles.folderCount}>{t('itemsCount', { count: folder.itemCount })}</span>
        </div>
      </FolderShape>
    </div>
  )
}

/** Dashed folder outline at the end of the grid — Floe's empty slot, here "create folder". */
export function NewFolderCard({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations('files')
  return (
    <div className={styles.folderCard}>
      <FolderShape folderId="new" cover={null} ghost>
        <button type="button" className={styles.hit} onClick={onCreate} aria-label={t('newFolder')} />
        <div className={styles.newFolder}>
          <span className={styles.newFolderIcon}><FilesPlusIcon size={18} /></span>
          {t('newFolder')}
        </div>
      </FolderShape>
    </div>
  )
}
