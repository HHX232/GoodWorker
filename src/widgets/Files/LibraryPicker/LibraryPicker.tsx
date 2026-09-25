'use client'

import { resolveCover } from '@/shared/lib/tutorFiles/covers'
import type { LibraryFile, LibraryFolder, LibraryResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesCheckIcon, FilesChevronIcon, FilesFolderIcon, FilesSearchIcon } from '../icons'
import { fileKind, filesFetch, formatBytes, KIND_COLOR, KIND_ICON } from '../lib'
import ui from '../ui.module.scss'
import styles from './LibraryPicker.module.scss'

/** What an editor gets back — the same `{name, size, mimeType, url}` shape the upload paths already store. */
export interface PickedFile {
  id: string
  name: string
  size: number
  mimeType: string
  url: string
}

export type PickAccept = 'any' | 'media' | 'image' | 'audio'

function accepts(accept: PickAccept, f: LibraryFile): boolean {
  if (accept === 'any') return true
  const kind = fileKind(f.mimeType, f.name)
  if (accept === 'media') return kind === 'image' || kind === 'video'
  return kind === accept
}

/** Audio blocks need the waveform, which is computed from the bytes — fetched through the access-checked API. */
export async function pickedFileAsFile(f: PickedFile): Promise<File> {
  const res = await fetch(`/api/tutor-files/files/${f.id}/content`)
  if (!res.ok) throw new Error(String(res.status))
  return new File([await res.blob()], f.name, { type: f.mimeType })
}

interface LibraryPickerModalProps {
  accept: PickAccept
  multiple: boolean
  /** Max files this pick may return (the editor's remaining slots). */
  max: number
  onPick: (files: PickedFile[]) => void
  onClose: () => void
}

export function LibraryPickerModal({ accept, multiple, max, onPick, onClose }: LibraryPickerModalProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<Map<string, LibraryFile>>(new Map())

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(id)
  }, [query])

  const library = useQuery({
    queryKey: ['tutor-files', 'library', folderId],
    queryFn: () => filesFetch<LibraryResponse>(`/api/tutor-files/library${folderId ? `?folderId=${folderId}` : ''}`),
  })
  const search = useQuery({
    queryKey: ['tutor-files', 'search', debounced],
    queryFn: () => filesFetch<{ folders: LibraryFolder[]; files: LibraryFile[] }>(`/api/tutor-files/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length > 0,
  })

  const searching = debounced.length > 0
  const folders = searching ? search.data?.folders ?? [] : library.data?.groups[0]?.folders ?? []
  const files = (searching ? search.data?.files ?? [] : library.data?.groups[0]?.files ?? []).filter(f => accepts(accept, f))
  const limit = multiple ? max : 1

  const toggle = (f: LibraryFile) => {
    setSelected(prev => {
      const next = new Map(multiple ? prev : [])
      if (next.has(f.id)) next.delete(f.id)
      else if (next.size < limit) next.set(f.id, f)
      return next
    })
  }

  const open = (id: string | null) => {
    setFolderId(id)
    setQuery('')
    setDebounced('')
  }

  const confirm = () => {
    onPick([...selected.values()].map(f => ({ id: f.id, name: f.name, size: f.sizeBytes, mimeType: f.mimeType, url: f.url })))
    onClose()
  }

  return (
    <FilesModal
      size="wide"
      title={t('pickTitle')}
      closeLabel={t('close')}
      onClose={onClose}
      footer={
        <>
          <span className={styles.footNote}>{multiple ? t('pickLimit', { n: Math.max(0, limit - selected.size) }) : ''}</span>
          <button type="button" className={ui.btn} onClick={e => { e.stopPropagation(); onClose() }}>{t('cancel')}</button>
          <button type="button" className={`${ui.btn} ${ui.primary}`} disabled={selected.size === 0} onClick={confirm}>
            {t('pickAdd')}{selected.size > 0 ? ` · ${selected.size}` : ''}
          </button>
        </>
      }
    >
      <label className={styles.search}>
        <FilesSearchIcon size={15} className={styles.searchIcon} />
        <input className={ui.input} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} />
      </label>

      {!searching && library.data && (
        <nav className={styles.crumbs}>
          <button type="button" className={styles.crumb} onClick={() => open(null)}>{t('myFiles')}</button>
          {[...library.data.breadcrumbs, ...(library.data.folder ? [library.data.folder] : [])].map(b => (
            <span key={b.id} className={styles.crumbItem}>
              <FilesChevronIcon size={12} />
              <button type="button" className={styles.crumb} onClick={() => open(b.id)}>{b.name}</button>
            </span>
          ))}
        </nav>
      )}

      <ul className={styles.list}>
        {folders.map(f => {
          const cover = resolveCover(f.id, f.cover)
          return (
            <li key={f.id}>
              <button type="button" className={styles.row} onClick={() => open(f.id)}>
                <span className={styles.swatch} style={{ background: cover.kind === 'image' ? `center / cover url("${cover.url}")` : cover.preset.background }}>
                  <FilesFolderIcon size={14} />
                </span>
                <span className={styles.rowName}>{f.name}</span>
                <span className={styles.rowMeta}>{t('itemsCount', { count: f.itemCount })}</span>
                <FilesChevronIcon size={14} className={styles.rowChevron} />
              </button>
            </li>
          )
        })}
        {files.map(f => {
          const kind = fileKind(f.mimeType, f.name)
          const Icon = KIND_ICON[kind]
          const on = selected.has(f.id)
          const full = !on && selected.size >= limit && multiple
          return (
            <li key={f.id}>
              <button type="button" className={`${styles.row} ${on ? styles.rowOn : ''}`} onClick={() => toggle(f)} disabled={full} aria-pressed={on}>
                <span className={`${styles.check} ${on ? styles.checkOn : ''}`}>{on && <FilesCheckIcon size={12} strokeWidth={3} />}</span>
                {kind === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.url} alt="" className={styles.thumb} />
                  : <span className={styles.fileIcon} style={{ color: KIND_COLOR[kind] }}><Icon size={18} /></span>}
                <span className={styles.rowName}>{f.name}</span>
                <span className={styles.rowMeta}>{formatBytes(f.sizeBytes, locale)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {(library.data || search.data) && folders.length + files.length === 0 && <p className={styles.empty}>{t('pickEmpty')}</p>}
    </FilesModal>
  )
}

interface LibraryPickButtonProps extends Omit<LibraryPickerModalProps, 'onClose'> {
  className?: string
  disabled?: boolean
}

/**
 * "Из хранилища" next to an editor's own upload button. Renders nothing for
 * students or tutors without VIP (no library), so editors can drop it in
 * unconditionally. The picked file is referenced by its public URL — the
 * post/homework/course keeps working even if the library item is later
 * deleted (objects are never removed from S3).
 */
export function LibraryPickButton({ className, disabled, ...picker }: LibraryPickButtonProps) {
  const t = useTranslations('files')
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const isTutor = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'
  const { data } = useQuery({
    queryKey: ['tutor-files', 'library', null],
    queryFn: () => filesFetch<LibraryResponse>('/api/tutor-files/library'),
    enabled: isTutor,
    staleTime: 60_000,
  })
  if (!isTutor || !data?.isVip) return null

  return (
    <>
      <button type="button" className={`${styles.pickBtn} ${className ?? ''}`} onClick={e => { e.stopPropagation(); setOpen(true) }} disabled={disabled || picker.max <= 0}>
        <FilesFolderIcon size={15} />
        {t('pickFromLibrary')}
      </button>
      {open && <LibraryPickerModal {...picker} onClose={() => setOpen(false)} />}
    </>
  )
}
