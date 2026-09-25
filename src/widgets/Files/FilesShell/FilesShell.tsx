'use client'

import { MAX_FILE_BYTES, MAX_FOLDER_DEPTH, QUOTA_BYTES } from '@/shared/lib/tutorFiles/constants'
import type { LibraryFile, LibraryFolder, LibraryResponse, TreeNode, UsageResponse } from '@/shared/types/TutorFiles/tutorFiles.types'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FileCard } from '../Cards/FileCard'
import { FolderCard } from '../Cards/FolderCard'
import { FilePreviewModal } from '../FilePreviewModal/FilePreviewModal'
import { FilesModal } from '../FilesModal/FilesModal'
import { FolderTree } from '../FolderTree/FolderTree'
import {
  FilesChevronDownIcon, FilesChevronIcon, FilesDropboxIcon, FilesFolderPlusIcon, FilesSearchIcon, FilesStorageIcon, FilesUploadIcon, FilesVipIcon,
} from '../icons'
import { filesFetch, FilesApiError, formatBytes, initials, jsonInit } from '../lib'
import { ShareAccessModal, type ShareTarget } from '../ShareAccessModal/ShareAccessModal'
import { StorageOverageWarningModal } from '../StorageOverageWarningModal/StorageOverageWarningModal'
import ui from '../ui.module.scss'
import styles from './FilesShell.module.scss'

export interface FilesShellProps {
  role: 'teacher' | 'student'
}

type NameDialog = { mode: 'create' } | { mode: 'rename'; folder: LibraryFolder }
type DeleteTarget = { itemType: 'folder'; item: LibraryFolder } | { itemType: 'file'; item: LibraryFile }

const LIBRARY_KEY = ['tutor-files', 'library'] as const

function pathOf(parentId: string | null, byId: Map<string, TreeNode>): string {
  const names: string[] = []
  let id = parentId
  while (id) {
    const node = byId.get(id)
    if (!node) break
    names.unshift(node.name)
    id = node.parentId
  }
  return names.join(' / ')
}

/**
 * The Files tab for both sides (tickets 05/07): sidebar folder tree, then
 * breadcrumbs + global search + card grid. Teacher: create/rename/delete,
 * upload, share (ticket 06), VIP gate + storage meter. Student: read-only
 * browse of what's shared, grouped by tutor, upload only inside their own
 * "учебная" subfolder. Everything comes from GET /api/tutor-files/library,
 * which already applies the server-side visibility rule.
 */
export function FilesShell({ role }: FilesShellProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isTeacher = role === 'teacher'

  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [treeOpen, setTreeOpen] = useState(false)
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null)
  const [overage, setOverage] = useState<UsageResponse | null>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(id)
  }, [query])

  const library = useQuery({
    queryKey: [...LIBRARY_KEY, folderId],
    queryFn: () => filesFetch<LibraryResponse>(`/api/tutor-files/library${folderId ? `?folderId=${folderId}` : ''}`),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const data = library.data
  const isVip = !!data?.isVip

  const search = useQuery({
    queryKey: ['tutor-files', 'search', debouncedQuery],
    queryFn: () => filesFetch<{ folders: LibraryFolder[]; files: LibraryFile[] }>(`/api/tutor-files/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length > 0,
  })

  const usage = useQuery({
    queryKey: ['tutor-files', 'usage'],
    queryFn: () => filesFetch<UsageResponse>('/api/tutor-files/usage'),
    enabled: isTeacher && isVip,
  })

  // An open folder that vanished (deleted from search, access revoked) → back to the root.
  useEffect(() => {
    if (folderId && library.error instanceof FilesApiError && (library.error.status === 403 || library.error.status === 404)) setFolderId(null)
  }, [library.error, folderId])

  const treeById = useMemo(() => new Map((data?.tree ?? []).map(n => [n.id, n])), [data])
  const openPath = useMemo(() => [...(data?.breadcrumbs ?? []).map(b => b.id), ...(data?.folder ? [data.folder.id] : [])], [data])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tutor-files'] })
  }

  const navigate = (id: string | null) => {
    setFolderId(id)
    setQuery('')
    setDebouncedQuery('')
    setTreeOpen(false)
  }

  const errorText = (e: unknown) => {
    if (e instanceof FilesApiError) {
      if (e.code === 'VIP_REQUIRED') return t('errVip')
      if (e.code === 'MAX_DEPTH') return t('errMaxDepth', { max: MAX_FOLDER_DEPTH })
    }
    return t('errGeneric')
  }

  // ── Upload ────────────────────────────────────────────────
  const uploadFiles = async (list: File[]) => {
    if (list.length === 0 || uploading) return
    let crossedQuota = false
    setUploading({ done: 0, total: list.length })
    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      if (file.size > MAX_FILE_BYTES) {
        toast.error(t('errTooLarge', { name: file.name }))
      } else {
        const form = new FormData()
        form.append('file', file)
        if (folderId) form.append('folderId', folderId)
        try {
          const res = await filesFetch<{ file: LibraryFile; usedBytes?: number }>('/api/tutor-files/files', { method: 'POST', body: form })
          // G02: warn only on the upload that *first* crosses the quota —
          // "was the library already over before this file?" comes straight
          // from the post-write usedBytes minus this file's size.
          if (typeof res.usedBytes === 'number' && res.usedBytes > QUOTA_BYTES && res.usedBytes - res.file.sizeBytes <= QUOTA_BYTES) crossedQuota = true
        } catch (e) {
          toast.error(e instanceof FilesApiError && e.code === 'VIP_REQUIRED' ? t('errVip') : t('errUpload', { name: file.name }))
        }
      }
      setUploading({ done: i + 1, total: list.length })
    }
    setUploading(null)
    refresh()
    if (crossedQuota) {
      try {
        setOverage(await queryClient.fetchQuery({ queryKey: ['tutor-files', 'usage'], queryFn: () => filesFetch<UsageResponse>('/api/tutor-files/usage'), staleTime: 0 }))
      } catch (e) {
        console.error('[FilesShell] usage after overage failed', e)
      }
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (data?.canUpload) uploadFiles(Array.from(e.dataTransfer.files))
  }

  // ── Folder create / rename, delete ────────────────────────
  const openCreate = () => {
    if (data?.folder && data.folder.depth >= MAX_FOLDER_DEPTH) {
      toast.error(t('errMaxDepth', { max: MAX_FOLDER_DEPTH }))
      return
    }
    setNameDialog({ mode: 'create' })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await filesFetch(`/api/tutor-files/${target.itemType === 'folder' ? 'folders' : 'files'}/${target.item.id}`, { method: 'DELETE' })
    } catch (e) {
      toast.error(errorText(e))
    }
    refresh()
  }

  // ── Render ────────────────────────────────────────────────
  if (library.isError && !data) {
    return (
      <div className={styles.state}>
        <p className={styles.stateText}>{t('errLoad')}</p>
        <button type="button" className={ui.btn} onClick={() => library.refetch()}>{t('retry')}</button>
      </div>
    )
  }

  if (!data) return <div className={styles.skeletonGrid} aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeleton} />)}</div>

  // G01: the tab is visible to every tutor, the library itself only with VIP.
  if (isTeacher && !isVip) {
    return (
      <div className={styles.upsell}>
        <span className={styles.upsellIcon}><FilesVipIcon size={26} strokeWidth={1.8} /></span>
        <h3 className={styles.upsellTitle}>{t('upsellTitle')}</h3>
        <p className={styles.upsellText}>{t('upsellText')}</p>
        <Link href="/vip" className={`${ui.btn} ${ui.primary}`}>{t('upsellCta')}</Link>
      </div>
    )
  }

  const canManage = isTeacher && isVip
  const canUpload = data.canUpload
  const myId = session?.user?.id
  const searching = debouncedQuery.length > 0
  const totalItems = data.groups.reduce((n, g) => n + g.folders.length + g.files.length, 0)
  const showGroupHeaders = !isTeacher && data.folder === null && data.groups.length > 1

  const folderActions = (f: LibraryFolder) => canManage
    ? {
        onShare: () => setShareTarget({ itemType: 'folder', id: f.id, name: f.name, allowStudentUpload: f.allowStudentUpload }),
        onRename: () => setNameDialog({ mode: 'rename', folder: f }),
        onDelete: () => setDeleteTarget({ itemType: 'folder', item: f }),
      }
    : {}
  const fileActions = (f: LibraryFile) => {
    if (canManage) {
      return {
        onShare: () => setShareTarget({ itemType: 'file', id: f.id, name: f.name }),
        onDelete: () => setDeleteTarget({ itemType: 'file', item: f }),
      }
    }
    // Student: may take back only their own submission, inside their own subfolder.
    if (canUpload && f.uploadedByRole === 'STUDENT' && f.uploadedById === myId) return { onDelete: () => setDeleteTarget({ itemType: 'file', item: f }) }
    return {}
  }

  const renderGrid = (folders: LibraryFolder[], files: LibraryFile[], withHints = false) => (
    <div className={styles.grid}>
      {folders.map(f => (
        <FolderCard key={f.id} folder={f} onOpen={() => navigate(f.id)} hint={withHints ? pathOf(f.parentId, treeById) || t('rootCrumb') : undefined} {...folderActions(f)} />
      ))}
      {files.map(f => (
        <FileCard key={f.id} file={f} onPreview={() => setPreviewFile(f)} hint={withHints ? pathOf(f.folderId, treeById) || t('rootCrumb') : undefined} {...fileActions(f)} />
      ))}
    </div>
  )

  const tree = (
    <FolderTree nodes={data.tree} teachers={data.teachers} currentId={folderId} openPath={openPath} rootLabel={t('rootCrumb')} onSelect={navigate} />
  )

  const usageData = usage.data
  const over = usageData ? usageData.usedBytes > usageData.quotaBytes : false

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>{t('treeTitle')}</div>
          {tree}
          {usageData && (
            <div className={`${styles.usage} ${over ? styles.usageOver : ''}`}>
              <div className={styles.usageRow}>
                <FilesStorageIcon size={14} />
                <span>{t('usage', { used: formatBytes(usageData.usedBytes, locale), quota: formatBytes(usageData.quotaBytes, locale) })}</span>
              </div>
              <div className={styles.usageBar}><span style={{ width: `${Math.min(100, (usageData.usedBytes / usageData.quotaBytes) * 100)}%` }} /></div>
              {over && <div className={styles.usageNote}>{t('usageOver', { gb: usageData.overageGb })}</div>}
            </div>
          )}
        </aside>

        <section
          className={`${styles.main} ${dragOver ? styles.dragOver : ''}`}
          onDragOver={canUpload ? e => { e.preventDefault(); setDragOver(true) } : undefined}
          onDragLeave={canUpload ? e => { if (e.currentTarget === e.target) setDragOver(false) } : undefined}
          onDrop={canUpload ? onDrop : undefined}
        >
          <div className={styles.toolbar}>
            <div className={styles.treeToggleWrap}>
              <button type="button" className={`${ui.btn} ${styles.treeToggle}`} onClick={() => setTreeOpen(v => !v)} aria-expanded={treeOpen}>
                {t('treeTitle')} <FilesChevronDownIcon size={14} />
              </button>
              {treeOpen && <div className={styles.treePopover}>{tree}</div>}
            </div>
            <label className={styles.search}>
              <FilesSearchIcon size={15} className={styles.searchIcon} />
              <input className={ui.input} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} />
            </label>
            {canManage && (
              <button type="button" className={ui.btn} onClick={openCreate}>
                <FilesFolderPlusIcon size={15} /> <span className={styles.btnLabel}>{t('newFolder')}</span>
              </button>
            )}
            {canUpload && (
              <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => fileInputRef.current?.click()} disabled={!!uploading}>
                <FilesUploadIcon size={15} />
                <span className={styles.btnLabel}>{uploading ? t('uploading', uploading) : t('upload')}</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" multiple hidden onChange={e => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          </div>

          {!searching && (
            <nav className={styles.crumbs} aria-label="breadcrumbs">
              <button type="button" className={styles.crumb} onClick={() => navigate(null)}>{t('rootCrumb')}</button>
              {data.breadcrumbs.map(b => (
                <span key={b.id} className={styles.crumbItem}>
                  <FilesChevronIcon size={13} className={styles.crumbSep} />
                  <button type="button" className={styles.crumb} onClick={() => navigate(b.id)}>{b.name}</button>
                </span>
              ))}
              {data.folder && (
                <span className={styles.crumbItem}>
                  <FilesChevronIcon size={13} className={styles.crumbSep} />
                  <span className={`${styles.crumb} ${styles.crumbCurrent}`} aria-current="page">{data.folder.name}</span>
                </span>
              )}
            </nav>
          )}

          {!searching && !isTeacher && canUpload && (
            <div className={styles.banner}><FilesDropboxIcon size={16} /> {t('dropboxHint')}</div>
          )}

          {dragOver && <div className={styles.dropHint}><FilesUploadIcon size={18} /> {t('dropHint')}</div>}

          {searching ? (
            <>
              <div className={styles.sectionTitle}>{t('searchResults')}</div>
              {search.data && search.data.folders.length + search.data.files.length === 0
                ? <p className={styles.muted}>{t('searchEmpty', { q: debouncedQuery })}</p>
                : search.data && renderGrid(search.data.folders, search.data.files, true)}
            </>
          ) : totalItems === 0 ? (
            <div className={styles.empty}>
              {isTeacher && data.folder === null ? (
                <>
                  <span className={styles.emptyIcon}><FilesFolderPlusIcon size={26} strokeWidth={1.6} /></span>
                  <div className={styles.emptyTitle}>{t('emptyTitle')}</div>
                  <p className={styles.emptyText}>{t('emptyText')}</p>
                </>
              ) : !isTeacher && data.folder === null ? (
                <>
                  <span className={styles.emptyIcon}><FilesStorageIcon size={26} strokeWidth={1.6} /></span>
                  <div className={styles.emptyTitle}>{t('studentEmptyTitle')}</div>
                  <p className={styles.emptyText}>{t('studentEmptyText')}</p>
                </>
              ) : (
                <div className={styles.emptyTitle}>{t('emptyFolder')}</div>
              )}
              {(canManage || canUpload) && (
                <div className={styles.emptyActions}>
                  {canManage && <button type="button" className={ui.btn} onClick={openCreate}><FilesFolderPlusIcon size={15} /> {t('newFolder')}</button>}
                  {canUpload && <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => fileInputRef.current?.click()}><FilesUploadIcon size={15} /> {t('upload')}</button>}
                </div>
              )}
            </div>
          ) : (
            data.groups.map(group => (
              <div key={group.teacher?.id ?? 'own'} className={styles.group}>
                {showGroupHeaders && group.teacher && (
                  <div className={styles.groupHeader}>
                    {group.teacher.avatarUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={group.teacher.avatarUrl} alt="" className={styles.groupAvatar} />
                      : <span className={styles.groupAvatar}>{initials(group.teacher.name)}</span>}
                    {t('fromTeacher', { name: group.teacher.name })}
                  </div>
                )}
                {renderGrid(group.folders, group.files)}
              </div>
            ))
          )}
        </section>
      </div>

      {nameDialog && (
        <FolderNameDialog
          dialog={nameDialog}
          parentId={folderId}
          onClose={() => setNameDialog(null)}
          onDone={() => { setNameDialog(null); refresh() }}
          errorText={errorText}
        />
      )}

      {deleteTarget && (
        <FilesModal
          title={t('deleteTitle')}
          closeLabel={t('close')}
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className={ui.btn} onClick={e => { e.stopPropagation(); setDeleteTarget(null) }}>{t('cancel')}</button>
              <button type="button" className={`${ui.btn} ${ui.danger}`} onClick={confirmDelete}>{t('delete')}</button>
            </>
          }
        >
          <p className={styles.dialogText}>
            {deleteTarget.itemType === 'folder' ? t('deleteFolderConfirm', { name: deleteTarget.item.name }) : t('deleteFileConfirm', { name: deleteTarget.item.name })}
          </p>
        </FilesModal>
      )}

      {shareTarget && <ShareAccessModal target={shareTarget} onClose={() => setShareTarget(null)} onChanged={refresh} />}
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {overage && <StorageOverageWarningModal overageGb={overage.overageGb} priceCentsPerGbMonth={overage.priceCentsPerGbMonth} onClose={() => setOverage(null)} />}
    </div>
  )
}

function FolderNameDialog({ dialog, parentId, onClose, onDone, errorText }: {
  dialog: NameDialog
  parentId: string | null
  onClose: () => void
  onDone: () => void
  errorText: (e: unknown) => string
}) {
  const t = useTranslations('files')
  const [name, setName] = useState(dialog.mode === 'rename' ? dialog.folder.name : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      if (dialog.mode === 'create') await filesFetch('/api/tutor-files/folders', jsonInit('POST', { name: trimmed, parentId }))
      else await filesFetch(`/api/tutor-files/folders/${dialog.folder.id}`, jsonInit('PATCH', { name: trimmed }))
      onDone()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <FilesModal
      title={dialog.mode === 'create' ? t('newFolderTitle') : t('renameTitle')}
      closeLabel={t('close')}
      onClose={onClose}
    >
      <form onSubmit={submit} className={styles.nameForm}>
        <input className={ui.input} value={name} onChange={e => setName(e.target.value)} placeholder={t('folderNamePlaceholder')} maxLength={120} autoFocus />
        {error && <div className={ui.error} role="alert">{error}</div>}
        <div className={styles.nameActions}>
          <button type="button" className={ui.btn} onClick={e => { e.stopPropagation(); onClose() }}>{t('cancel')}</button>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy || !name.trim()}>
            {dialog.mode === 'create' ? t('create') : t('save')}
          </button>
        </div>
      </form>
    </FilesModal>
  )
}
