'use client'

import { resolveCover } from '@/shared/lib/tutorFiles/covers'
import type { LibraryFile, LinkedFolderResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { FilePreviewModal } from '../FilePreviewModal/FilePreviewModal'
import { FilesChevronIcon, FilesDeleteIcon, FilesDownloadIcon, FilesFolderIcon } from '../icons'
import { fileKind, filesFetch, formatBytes, KIND_COLOR, KIND_ICON, triggerDownload, viewerFor } from '../lib'
import styles from './SharedFolderBlock.module.scss'

interface SharedFolderBlockProps {
  token: string
  /** Name stored with the attachment — shown while loading / if the folder is gone. */
  name: string
  /** Editor mode: a remove button instead of nothing. */
  onRemove?: () => void
}

type Node = { id: string; name: string; parentId: string | null }

/**
 * A whole library folder attached to homework / a post / a test / a course.
 * Everything inside unfolds right here — subfolders as collapsible sections,
 * files as rows that open in the built-in viewer — so the student never
 * leaves the page. Reads through the folder's link token.
 */
export function SharedFolderBlock({ token, name, onRemove }: SharedFolderBlockProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const [preview, setPreview] = useState<LibraryFile | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const { data, isError, isLoading } = useQuery({
    queryKey: ['tutor-files', 'link', token],
    queryFn: () => filesFetch<LinkedFolderResponse>(`/api/tutor-files/links/${token}`),
    retry: false,
    staleTime: 60_000,
  })

  const byParent = useMemo(() => {
    const map = new Map<string | null, Node[]>()
    for (const f of data?.folders ?? []) {
      const list = map.get(f.parentId) ?? []
      list.push(f)
      map.set(f.parentId, list)
    }
    return map
  }, [data])
  const filesBy = useMemo(() => {
    const map = new Map<string, LibraryFile[]>()
    for (const f of data?.files ?? []) {
      const list = map.get(f.folderId ?? '') ?? []
      list.push(f)
      map.set(f.folderId ?? '', list)
    }
    return map
  }, [data])

  const markOpened = (f: LibraryFile) => {
    fetch(`/api/tutor-files/links/${token}/files/${f.id}/open`, { method: 'POST' }).catch(() => {})
  }
  const open = (f: LibraryFile) => {
    markOpened(f)
    if (viewerFor(f.mimeType, f.name)) setPreview(f)
    else triggerDownload(f)
  }

  const renderFiles = (folderId: string) => (
    <ul className={styles.files}>
      {(filesBy.get(folderId) ?? []).map(f => {
        const kind = fileKind(f.mimeType, f.name)
        const Icon = KIND_ICON[kind]
        return (
          <li key={f.id}>
            <button type="button" className={styles.file} onClick={() => open(f)}>
              <span className={styles.fileIcon} style={{ color: KIND_COLOR[kind] }}><Icon size={17} /></span>
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileSize}>{formatBytes(f.sizeBytes, locale)}</span>
            </button>
            <button type="button" className={styles.download} onClick={() => { markOpened(f); triggerDownload(f) }} aria-label={t('download')} title={t('download')}>
              <FilesDownloadIcon size={15} />
            </button>
          </li>
        )
      })}
    </ul>
  )

  const renderFolder = (node: Node, depth: number) => {
    const isCollapsed = collapsed.has(node.id)
    const toggle = () => setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      return next
    })
    return (
      <div key={node.id} className={styles.sub} style={{ marginLeft: depth ? 14 : 0 }}>
        <button type="button" className={styles.subHead} onClick={toggle} aria-expanded={!isCollapsed}>
          <FilesChevronIcon size={14} className={`${styles.chevron} ${isCollapsed ? '' : styles.chevronOpen}`} />
          <FilesFolderIcon size={15} />
          <span>{node.name}</span>
        </button>
        {!isCollapsed && (
          <div className={styles.subBody}>
            {renderFiles(node.id)}
            {(byParent.get(node.id) ?? []).map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const cover = resolveCover(data?.folder.id ?? token, data?.folder.cover)
  const swatch = cover.kind === 'image' ? `center / cover url("${cover.url}")` : cover.preset.background
  const total = data?.files.length ?? 0

  return (
    <div className={styles.block}>
      <div className={styles.head}>
        <span className={styles.swatch} style={{ background: swatch }}><FilesFolderIcon size={18} /></span>
        <span className={styles.headText}>
          <span className={styles.title}>{data?.folder.name ?? name}</span>
          <span className={styles.meta}>
            {isError ? t('linkUnavailable') : data ? `${t('linkFrom', { name: data.teacher.name })} · ${t('itemsCount', { count: total })}` : t('previewLoading')}
          </span>
        </span>
        {onRemove && (
          <button type="button" className={styles.remove} onClick={onRemove} aria-label={t('delete')} title={t('delete')}><FilesDeleteIcon size={15} /></button>
        )}
      </div>
      {data && !isLoading && (
        <div className={styles.body}>
          {renderFiles(data.folder.id)}
          {(byParent.get(data.folder.id) ?? []).map(child => renderFolder(child, 0))}
          {total === 0 && <p className={styles.empty}>{t('emptyFolder')}</p>}
        </div>
      )}
      {preview && (
        <FilePreviewModal
          file={preview}
          contentUrl={`/api/tutor-files/links/${token}/files/${preview.id}/content`}
          onClose={() => setPreview(null)}
          onDownload={() => triggerDownload(preview)}
        />
      )}
    </div>
  )
}
