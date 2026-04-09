/* eslint-disable react-hooks/static-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow, useStore} from '@xyflow/react'
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
import {useRef} from 'react'
import styles from './FileRow.module.scss'

interface UploadedFile {
  name: string
  size: number
  mimeType: string
  url: string
}

type FileBlockData = RoadNodeData & {
  uploadedFiles?: UploadedFile[]
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
  return <Image width={350} height={350} src={url} alt={name} className={styles.imagePreview} />
}

function FileRow({file, onRemove, t}: {file: UploadedFile; onRemove: () => void; t: any}) {
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
        <Icon size={20} />
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
          <DownloadIcon size={13} />
        </button>
        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={onRemove} title={t('removeFile')}>
          <Trash2Icon size={13} />
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

function FileRowReadonly({file, t}: {file: UploadedFile; t: any}) {
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
        <Icon size={20} />
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
        <button
          onMouseDown={(e) => e.stopPropagation()}
          className={styles.actionBtn}
          onClick={handleDownload}
          title={t('downloadFile')}
        >
          <DownloadIcon size={13} />
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

export default function FileBlock({nodeId}: {nodeId: string}) {
  const t = useTranslations('fileBlock')
  const readOnly = useViewMode() === 'view'
  const {updateNodeData} = useReactFlow()
  const fileRef = useRef<HTMLInputElement>(null)

  const files = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as FileBlockData)?.uploadedFiles ?? []) as UploadedFile[]
  )

  const update = (patch: Partial<FileBlockData>) => updateNodeData(nodeId, patch as any)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    const current = files
    const remaining = MAX_FILES - current.length
    const newFiles: UploadedFile[] = []
    for (const file of selected.slice(0, remaining)) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) continue
      newFiles.push({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        url: URL.createObjectURL(file)
      })
    }
    update({uploadedFiles: [...current, ...newFiles]})
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeFile = (index: number) => {
    if (readOnly) return
    const next = files.filter((_, i) => i !== index)
    update({uploadedFiles: next})
  }

  const canAddMore = files.length < MAX_FILES

  // ── Режим просмотра ──
  if (readOnly) {
    if (files.length === 0) {
      return (
        <div className={`${styles.block} nodrag nopan`}>
          <div className={styles.emptyState}>
            <FileIcon size={24} style={{color: '#c4c8d0'}} />
            <p className={styles.emptyText}>{t('filesNotAttached')}</p>
          </div>
        </div>
      )
    }

    return (
      <div className={`${styles.block} nodrag nopan`}>
        <div className={styles.fileList}>
          {files.map((file, i) => (
            <FileRowReadonly key={`${file.name}-${i}`} file={file} t={t} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.block} nodrag nopan`}>
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
        >
          <UploadIcon size={files.length > 0 ? 14 : 20} />
          <div className={styles.uploadText}>
            <span>{files.length > 0 ? t('addFiles') : t('uploadFiles')}</span>
            {files.length === 0 && (
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
