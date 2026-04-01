/* eslint-disable react-hooks/static-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useReactFlow, useStore} from '@xyflow/react'
import {
  DownloadIcon,
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileMusicIcon,
  FileTextIcon,
  FileVideoIcon,
  Trash2Icon,
  UploadIcon
} from 'lucide-react'
import {useRef} from 'react'
import styles from './FileRow.module.scss'

// ── Типы ─────────────────────────────────────────────────────────────────────

interface UploadedFile {
  name: string
  size: number
  mimeType: string
  url: string
}

type FileBlockData = RoadNodeData & {
  uploadedFiles?: UploadedFile[]
}

// ── Хелперы ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImageIcon
  if (mimeType.startsWith('video/')) return FileVideoIcon
  if (mimeType.startsWith('audio/')) return FileMusicIcon
  if (mimeType.includes('pdf') || mimeType.includes('text')) return FileTextIcon
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return FileArchiveIcon
  return FileIcon
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '#10b981'
  if (mimeType.startsWith('video/')) return '#6366f1'
  if (mimeType.startsWith('audio/')) return '#f59e0b'
  if (mimeType.includes('pdf')) return '#ef4444'
  if (mimeType.includes('text')) return '#3b82f6'
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '#8b5cf6'
  return '#868897'
}

function getFileExt(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE'
}

// ── Превью изображения ────────────────────────────────────────────────────────

function ImagePreview({url, name}: {url: string; name: string}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className={styles.imagePreview} />
  )
}

// ── Строка файла ──────────────────────────────────────────────────────────────

function FileRow({file, onRemove}: {file: UploadedFile; onRemove: () => void}) {
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
      {/* Иконка с цветом по типу */}
      <div className={styles.fileIcon} style={{color}}>
        <Icon size={20} />
        <span className={styles.fileExt} style={{backgroundColor: color}}>
          {getFileExt(file.name)}
        </span>
      </div>

      {/* Инфо */}
      <div className={styles.fileInfo}>
        <span className={styles.fileName} title={file.name}>
          {file.name}
        </span>
        <span className={styles.fileSize}>{formatSize(file.size)}</span>
      </div>

      {/* Действия */}
      <div className={styles.fileActions}>
        <button className={styles.actionBtn} onClick={handleDownload} title='Скачать (превью)'>
          <DownloadIcon size={13} />
        </button>
        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={onRemove} title='Удалить'>
          <Trash2Icon size={13} />
        </button>
      </div>

      {/* Превью изображения */}
      {isImage && (
        <div className={styles.imagePreviewWrap}>
          <ImagePreview url={file.url} name={file.name} />
        </div>
      )}
    </div>
  )
}

// ── Основной компонент ────────────────────────────────────────────────────────

const MAX_FILES = 10
const MAX_SIZE_MB = 50

export default function FileBlock({nodeId}: {nodeId: string}) {
  const {updateNodeData} = useReactFlow()
  const fileRef = useRef<HTMLInputElement>(null)

  const files = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as FileBlockData)?.uploadedFiles ?? []) as UploadedFile[]
  )

  const update = (patch: Partial<FileBlockData>) => updateNodeData(nodeId, patch as any)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return

    const current = files
    const remaining = MAX_FILES - current.length
    const newFiles: UploadedFile[] = []

    for (const file of selected.slice(0, remaining)) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) continue // пропускаем слишком большие
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
    const next = files.filter((_, i) => i !== index)
    update({uploadedFiles: next})
  }

  const canAddMore = files.length < MAX_FILES

  return (
    <div className={`${styles.block} nodrag nopan`}>
      <input ref={fileRef} type='file' multiple className={styles.hidden} onChange={handleFiles} />

      {/* ── Список файлов ── */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((file, i) => (
            <FileRow key={`${file.name}-${i}`} file={file} onRemove={() => removeFile(i)} />
          ))}
        </div>
      )}

      {/* ── Загрузка ── */}
      {canAddMore && (
        <button
          type='button'
          className={`${styles.uploadBtn} ${files.length > 0 ? styles.uploadBtnCompact : ''}`}
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon size={files.length > 0 ? 14 : 20} />
          <div className={styles.uploadText}>
            <span>{files.length > 0 ? 'Добавить файлы' : 'Загрузить файлы'}</span>
            {files.length === 0 && (
              <span className={styles.uploadHint}>
                Любые форматы · до {MAX_SIZE_MB} МБ · макс {MAX_FILES} файлов
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

      {/* ── Лимит достигнут ── */}
      {!canAddMore && <p className={styles.limitMsg}>Максимум {MAX_FILES} файлов</p>}
    </div>
  )
}
