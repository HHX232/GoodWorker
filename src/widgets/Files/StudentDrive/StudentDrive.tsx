'use client'

import type { LibraryFile, LibraryFolder } from '@/shared/types/TutorFiles/tutorFiles.types'
import type { DriveFile, DriveFolder, DriveLibraryResponse } from '@/shared/types/StudentDrive/studentDrive.types'
import { MAX_FOLDER_DEPTH } from '@/shared/lib/tutorFiles/constants'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FileCard } from '../Cards/FileCard'
import { FolderCard, NewFolderCard } from '../Cards/FolderCard'
import { FilePreviewModal } from '../FilePreviewModal/FilePreviewModal'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesChevronIcon, FilesFolderPlusIcon, FilesLectureIcon, FilesStorageIcon, FilesUploadIcon, FilesVipIcon } from '../icons'
import { filesFetch, FilesApiError, jsonInit, triggerDownload, viewerFor } from '../lib'
import { StorageMeter } from '../StorageMeter/StorageMeter'
import shell from '../FilesShell/FilesShell.module.scss'
import ui from '../ui.module.scss'

// The shared Floe cards take the tutor-library shapes; a drive item is the
// same thing minus sharing/review, so it's mapped onto them with those empty.
function asLibraryFolder(f: DriveFolder): LibraryFolder {
  return { id: f.id, name: f.name, parentId: f.parentId, allowStudentUpload: false, restrictedToStudentId: null, cover: null, submissionDeadline: null, itemCount: 0, sharedWith: [], updatedAt: f.createdAt }
}

function asLibraryFile(f: DriveFile, folderId: string | null): LibraryFile {
  return {
    id: f.id, name: f.name, folderId, url: f.url, sizeBytes: f.sizeBytes, mimeType: f.mimeType,
    uploadedByRole: 'STUDENT', uploadedById: '', createdAt: f.updatedAt, sharedWith: [], late: false, review: null, derivedFromId: null,
  }
}

type NameDialog = { mode: 'create' } | { mode: 'rename'; folder: DriveFolder }
type DeleteTarget = { kind: 'folder'; id: string; name: string } | { kind: 'file'; id: string; name: string }

/**
 * "Мои файлы" — the student's own drive on /files: lecture notes and their
 * own uploads, paid from the student's quota (never a tutor's). Same Floe
 * cards and chrome as the tutor library, no sharing.
 */
export function StudentDrive({ folderId, onNavigate }: { folderId: string | null; onNavigate: (id: string | null) => void }) {
  const t = useTranslations('files')
  const queryClient = useQueryClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [preview, setPreview] = useState<LibraryFile | null>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)

  const library = useQuery({
    queryKey: ['student-files', folderId],
    queryFn: () => filesFetch<DriveLibraryResponse>(`/api/student-files/library${folderId ? `?folderId=${folderId}` : ''}`),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const data = library.data
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['student-files'] })

  const upload = async (files: File[]) => {
    if (!files.length) return
    setUploading({ done: 0, total: files.length })
    for (const [i, file] of files.entries()) {
      const form = new FormData()
      form.append('file', file)
      if (folderId) form.append('folderId', folderId)
      try {
        await filesFetch('/api/student-files/files', { method: 'POST', body: form })
      } catch (e) {
        const code = e instanceof FilesApiError ? e.code : ''
        toast.error(code === 'VIP_REQUIRED' ? t('driveErrVip') : code === 'QUOTA_EXCEEDED' ? t('errQuota') : code === 'FILE_TOO_LARGE' ? t('errTooLarge', { name: file.name }) : t('errUpload', { name: file.name }))
      }
      setUploading({ done: i + 1, total: files.length })
    }
    setUploading(null)
    refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await filesFetch(`/api/student-files/${deleteTarget.kind === 'folder' ? 'folders' : 'files'}/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      refresh()
    } catch {
      toast.error(t('errGeneric'))
    }
  }

  // Through our API, never the bucket's public URL — browsers flag that domain as dangerous.
  const download = (f: { id: string; name: string }) => triggerDownload({ url: `/api/student-files/files/${f.id}/download`, name: f.name })

  const openFile = (f: DriveFile) => {
    if (f.lectureNoteId) { router.push(`/lecture/${f.lectureNoteId}`); return }
    if (viewerFor(f.mimeType, f.name)) setPreview(asLibraryFile(f, folderId))
    else download(f)
  }

  if (library.isError && !data) {
    return (
      <div className={shell.state}>
        <p className={shell.stateText}>{t('errLoad')}</p>
        <button type="button" className={ui.btn} onClick={() => library.refetch()}>{t('retry')}</button>
      </div>
    )
  }
  if (!data) return <div className={shell.skeletonGrid} aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className={shell.skeleton} />)}</div>

  const canWrite = data.isVip
  const depth = data.breadcrumbs.length
  const empty = data.folders.length === 0 && data.files.length === 0

  return (
    <>
      <div className={shell.topbar}>
        <div className={shell.meterSlot}>
          <StorageMeter usage={{ usedBytes: data.usedBytes, quotaBytes: data.quotaBytes, maxFileBytes: data.maxFileBytes, overageGb: 0, billing: null }} />
        </div>
      </div>
      <div className={shell.content}>
        {data.folder && (
          <nav className={shell.crumbs} aria-label="breadcrumbs">
            <button type="button" className={shell.crumb} onClick={() => onNavigate(null)}>{t('driveTitle')}</button>
            {data.breadcrumbs.map(b => (
              <span key={b.id} className={shell.crumbItem}>
                <FilesChevronIcon size={13} className={shell.crumbSep} />
                <button type="button" className={shell.crumb} onClick={() => onNavigate(b.id)}>{b.name}</button>
              </span>
            ))}
          </nav>
        )}
        <div className={shell.titleRow}>
          <h1 className={shell.title}>{data.folder?.name ?? t('driveTitle')}</h1>
          <div className={shell.actions}>
            <Link href="/lecture" className={shell.pill}><FilesLectureIcon size={14} /> <span className={shell.pillLabel}>{t('driveNewLecture')}</span></Link>
            {canWrite && depth < MAX_FOLDER_DEPTH && (
              <button type="button" className={shell.pill} onClick={() => setNameDialog({ mode: 'create' })}>
                <FilesFolderPlusIcon size={14} /> <span className={shell.pillLabel}>{t('newFolder')}</span>
              </button>
            )}
            {canWrite && (
              <button type="button" className={`${shell.pill} ${shell.pillPrimary}`} onClick={() => fileInputRef.current?.click()} disabled={!!uploading}>
                <FilesUploadIcon size={14} /> <span className={shell.pillLabel}>{uploading ? t('uploading', uploading) : t('upload')}</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" multiple hidden onChange={e => { upload(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          </div>
        </div>

        {!canWrite && <div className={shell.banner}><FilesVipIcon size={16} /> {t('driveVipBanner')}</div>}

        {empty ? (
          <div className={shell.empty}>
            <span className={shell.emptyIcon}><FilesStorageIcon size={26} strokeWidth={1.6} /></span>
            <div className={shell.emptyTitle}>{data.folder ? t('emptyFolder') : t('driveEmptyTitle')}</div>
            {!data.folder && <p className={shell.emptyText}>{t('driveEmptyText')}</p>}
          </div>
        ) : (
          <>
            {(data.folders.length > 0 || (canWrite && depth < MAX_FOLDER_DEPTH)) && (
              <section className={shell.section}>
                <h2 className={shell.sectionTitle}>{t('foldersSection')} <span className={shell.count}>{data.folders.length}</span></h2>
                <div className={shell.folderGrid}>
                  {data.folders.map(f => (
                    <FolderCard
                      key={f.id}
                      folder={asLibraryFolder(f)}
                      onOpen={() => onNavigate(f.id)}
                      onRename={() => setNameDialog({ mode: 'rename', folder: f })}
                      onDelete={() => setDeleteTarget({ kind: 'folder', id: f.id, name: f.name })}
                    />
                  ))}
                  {canWrite && depth < MAX_FOLDER_DEPTH && <NewFolderCard onCreate={() => setNameDialog({ mode: 'create' })} />}
                </div>
              </section>
            )}
            {data.files.length > 0 && (
              <section className={shell.section}>
                <h2 className={shell.sectionTitle}>{t('filesSection')} <span className={shell.count}>{data.files.length}</span></h2>
                <div className={shell.fileGrid}>
                  {data.files.map(f => (
                    <FileCard
                      key={f.id}
                      file={asLibraryFile(f, folderId)}
                      hint={f.lectureNoteId ? t('driveLectureHint') : undefined}
                      onPreview={() => openFile(f)}
                      onDownload={() => download(f)}
                      onDelete={() => setDeleteTarget({ kind: 'file', id: f.id, name: f.name })}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {nameDialog && <DriveNameDialog dialog={nameDialog} parentId={folderId} onClose={() => setNameDialog(null)} onDone={() => { setNameDialog(null); refresh() }} />}
      {deleteTarget && (
        <FilesModal
          title={t('deleteTitle')}
          closeLabel={t('close')}
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className={ui.btn} onClick={() => setDeleteTarget(null)}>{t('cancel')}</button>
              <button type="button" className={`${ui.btn} ${ui.danger}`} onClick={confirmDelete}>{t('delete')}</button>
            </>
          }
        >
          <p className={shell.dialogText}>
            {deleteTarget.kind === 'folder' ? t('deleteFolderConfirm', { name: deleteTarget.name }) : t('deleteFileConfirm', { name: deleteTarget.name })}
          </p>
        </FilesModal>
      )}
      {preview && <FilePreviewModal file={preview} contentUrl={`/api/student-files/files/${preview.id}/content`} onClose={() => setPreview(null)} onDownload={() => download(preview)} />}
    </>
  )
}

function DriveNameDialog({ dialog, parentId, onClose, onDone }: { dialog: NameDialog; parentId: string | null; onClose: () => void; onDone: () => void }) {
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
      if (dialog.mode === 'create') await filesFetch('/api/student-files/folders', jsonInit('POST', { name: trimmed, parentId }))
      else await filesFetch(`/api/student-files/folders/${dialog.folder.id}`, jsonInit('PATCH', { name: trimmed }))
      onDone()
    } catch (err) {
      const code = err instanceof FilesApiError ? err.code : ''
      setError(code === 'MAX_DEPTH' ? t('errMaxDepth', { max: MAX_FOLDER_DEPTH }) : code === 'VIP_REQUIRED' ? t('driveErrVip') : t('errGeneric'))
      setBusy(false)
    }
  }

  return (
    <FilesModal title={dialog.mode === 'create' ? t('newFolderTitle') : t('renameTitle')} closeLabel={t('close')} onClose={onClose}>
      <form onSubmit={submit} className={shell.nameForm}>
        <input className={ui.input} value={name} onChange={e => setName(e.target.value)} placeholder={t('folderNamePlaceholder')} maxLength={120} autoFocus />
        {error && <div className={ui.error} role="alert">{error}</div>}
        <div className={shell.nameActions}>
          <button type="button" className={ui.btn} onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy || !name.trim()}>{dialog.mode === 'create' ? t('create') : t('save')}</button>
        </div>
      </form>
    </FilesModal>
  )
}
