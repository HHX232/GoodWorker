'use client'

import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesDownloadIcon } from '../icons'
import { fileKind } from '../lib'
import ui from '../ui.module.scss'
import styles from './FilePreviewModal.module.scss'

/**
 * G05: PDFs and images open over the interface, straight off the public S3
 * URL — no download, no chat message (R03i.1). Other types never get here
 * (FileCard renders them as a download link).
 */
export function FilePreviewModal({ file, onClose }: { file: LibraryFile; onClose: () => void }) {
  const t = useTranslations('files')
  const kind = fileKind(file.mimeType, file.name)

  return (
    <FilesModal
      size="viewer"
      closeLabel={t('close')}
      onClose={onClose}
      title={
        <span className={styles.titleRow}>
          <span className={styles.name}>{file.name}</span>
          <a className={ui.btn} href={file.url} target="_blank" rel="noopener noreferrer" download={file.name}>
            <FilesDownloadIcon size={15} />
            <span className={styles.downloadLabel}>{t('download')}</span>
          </a>
        </span>
      }
    >
      <div className={styles.stage}>
        {kind === 'image'
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={file.url} alt={file.name} className={styles.image} />
          : <iframe src={file.url} title={file.name} className={styles.frame} />}
      </div>
    </FilesModal>
  )
}
