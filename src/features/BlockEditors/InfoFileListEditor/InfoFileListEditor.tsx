/* eslint-disable react-hooks/static-components */
'use client'

import {PostFileEntry, PostFileListPayload} from '@/shared/types/Post/Post.type'
import {uploadFile} from '@/shared/lib/uploadFile'
import {
  DownloadIcon,
  FileArchiveIcon,
  FileCheckIcon,
  FileIcon,
  FileImageIcon,
  FileMusicIcon,
  FilePlusIcon,
  FileTextIcon,
  FileVideoIcon,
  Trash2Icon,
  UploadIcon
} from 'lucide-react'
import {useTranslations} from 'next-intl'
import Image from 'next/image'
import {useRef, useState} from 'react'
import {toast} from 'sonner'
import styles from './InfoFileListEditor.module.scss'

interface Props {
  payload: PostFileListPayload
  onChange?: (payload: PostFileListPayload) => void
  viewOnly?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImageIcon
  if (mimeType.startsWith('video/')) return FileVideoIcon
  if (mimeType.startsWith('audio/')) return FileMusicIcon
  if (mimeType.includes('pdf')) return FileTextIcon
  if (mimeType.includes('word') || mimeType.includes('doc')) return FileTextIcon
  if (mimeType.includes('excel') || mimeType.includes('sheet') || mimeType.includes('spreadsheet')) return FileCheckIcon
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return FilePlusIcon
  if (mimeType.includes('text') || mimeType.includes('md') || mimeType.includes('csv')) return FileTextIcon
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return FileArchiveIcon
  if (mimeType.includes('font') || mimeType.includes('woff') || mimeType.includes('ttf')) return FileTextIcon
  return FileIcon
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '#10b981'
  if (mimeType.startsWith('video/')) return '#6366f1'
  if (mimeType.startsWith('audio/')) return '#f59e0b'
  if (mimeType.includes('pdf')) return '#ef4444'
  if (mimeType.includes('word') || mimeType.includes('doc')) return '#2563eb'
  if (mimeType.includes('excel') || mimeType.includes('sheet') || mimeType.includes('spreadsheet')) return '#16a34a'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '#ea580c'
  if (mimeType.includes('text') || mimeType.includes('md') || mimeType.includes('csv')) return '#3b82f6'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '#8b5cf6'
  if (mimeType.includes('font') || mimeType.includes('woff') || mimeType.includes('ttf')) return '#f472b6'
  return '#868897'
}

function getFileExt(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE'
}

function ImagePreview({url, name}: {url: string; name: string}) {
  return <Image width={500} height={500} src={url} alt={name} className={styles.imagePreview} />
}

type TFn = (key: string, values?: Record<string, string | number>) => string

function FileRow({file, onRemove, t}: {file: PostFileEntry; onRemove: () => void; t: TFn}) {
  const Icon = getFileIcon(file.mimeType)
  const color = getFileColor(file.mimeType)
  const isImage = file.mimeType.startsWith('image/')

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = file.url
    a.download = file.name
    a.click()
  }

  return (
    <div className={styles.fileRow}>
      <div className={styles.fileIcon} style={{color}}>
        <Icon size={26} />
        <span className={styles.fileExt} style={{backgroundColor: color}}>
          {getFileExt(file.name)}
        </span>
      </div>

      <div className={styles.fileInfo}>
        <span className={styles.fileName} title={file.name}>
          {file.name}
        </span>
        <span className={styles.fileSize}>{formatSize(file.size)}</span>
      </div>

      <div className={styles.fileActions}>
        <button className={styles.actionBtn} onClick={handleDownload} title={t('downloadFile')}>
          <DownloadIcon size={16} />
        </button>
        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={onRemove} title={t('removeFile')}>
          <Trash2Icon size={16} />
        </button>
      </div>

      {isImage && (
        <div className={styles.imagePreviewWrap}>
          <ImagePreview url={file.url} name={file.name} />
        </div>
      )}
    </div>
  )
}

function FileRowReadonly({file, t}: {file: PostFileEntry; t: TFn}) {
  const Icon = getFileIcon(file.mimeType)
  const color = getFileColor(file.mimeType)
  const isImage = file.mimeType.startsWith('image/')

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = file.url
    a.download = file.name
    a.click()
  }

  return (
    <div className={styles.fileRow}>
      <div className={styles.fileIcon} style={{color}}>
        <Icon size={26} />
        <span className={styles.fileExt} style={{backgroundColor: color}}>
          {getFileExt(file.name)}
        </span>
      </div>

      <div className={styles.fileInfo}>
        <span className={styles.fileName} title={file.name}>
          {file.name}
        </span>
        <span className={styles.fileSize}>{formatSize(file.size)}</span>
      </div>

      <div className={styles.fileActions}>
        <button className={styles.actionBtn} onClick={handleDownload} title={t('downloadFile')}>
          <DownloadIcon size={16} />
        </button>
      </div>

      {isImage && (
        <div className={styles.imagePreviewWrap}>
          <ImagePreview url={file.url} name={file.name} />
        </div>
      )}
    </div>
  )
}

const MAX_FILES = 10
const MAX_SIZE_MB = 50

export const InfoFileListEditor = ({payload, onChange, viewOnly = false}: Props) => {
  const t = useTranslations('InfoFileListEditor')
  const editable = !!onChange && !viewOnly
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const files = payload.files ?? []

  const update = (patch: Partial<PostFileListPayload>) => onChange?.({...payload, ...patch})

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editable) return
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    const remaining = MAX_FILES - files.length
    const toUpload = selected.slice(0, remaining).filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024)
    setUploading(true)
    try {
      const newFiles: PostFileEntry[] = await Promise.all(
        toUpload.map(async (file) => ({
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          url: await uploadFile(file, 'post-files')
        }))
      )
      update({files: [...files, ...newFiles]})
    } catch {
      toast.error(t('uploadError'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    if (!editable) return
    update({files: files.filter((_, i) => i !== index)})
  }

  const canAddMore = files.length < MAX_FILES

  // ── Режим просмотра ──
  if (!editable) {
    if (files.length === 0) return null

    return (
      <div className={styles.block}>
        <div className={styles.fileList}>
          {files.map((file, i) => (
            <FileRowReadonly key={`${file.name}-${i}`} file={file} t={t} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.block}>
      <input ref={fileRef} type='file' multiple className={styles.hidden} onChange={handleFiles} />

      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((file, i) => (
            <FileRow key={`${file.name}-${i}`} file={file} onRemove={() => removeFile(i)} t={t} />
          ))}
        </div>
      )}

      {canAddMore && (
        <button
          type='button'
          className={`${styles.uploadBtn} ${files.length > 0 ? styles.uploadBtnCompact : ''}`}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <UploadIcon size={files.length > 0 ? 16 : 24} />
          <div className={styles.uploadText}>
            <span>{uploading ? t('uploading') : files.length > 0 ? t('addFiles') : t('uploadFiles')}</span>
            {files.length === 0 && !uploading && (
              <span className={styles.uploadHint}>
                {t('anyFormatMaxSize', {maxSize: MAX_SIZE_MB, maxFiles: MAX_FILES})}
              </span>
            )}
          </div>
          {files.length > 0 && (
            <span className={styles.uploadCounter}>
              {files.length}/{MAX_FILES}
            </span>
          )}
        </button>
      )}

      {!canAddMore && <p className={styles.limitMsg}>{t('maxFilesLimit', {maxFiles: MAX_FILES})}</p>}
    </div>
  )
}
