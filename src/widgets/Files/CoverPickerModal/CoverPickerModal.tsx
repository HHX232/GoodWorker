'use client'

import { ART_PRESETS, MAX_COVER_BYTES, PASTEL_PRESETS, PRESET_PREFIX, type CoverPreset } from '@/shared/lib/tutorFiles/covers'
import { uploadFile } from '@/shared/lib/uploadFile'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { FolderShape } from '../Cards/FolderShape'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesCheckIcon, FilesUploadIcon } from '../icons'
import { filesFetch, jsonInit } from '../lib'
import ui from '../ui.module.scss'
import styles from './CoverPickerModal.module.scss'

interface CoverPickerModalProps {
  folder: { id: string; name: string; cover: string | null }
  onClose: () => void
  onSaved: () => void
}

/** Pick a folder background: a preset (pastel / artwork) or the tutor's own image. */
export function CoverPickerModal({ folder, onClose, onSaved }: CoverPickerModalProps) {
  const t = useTranslations('files')
  const [value, setValue] = useState<string | null>(folder.cover)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_COVER_BYTES) {
      setError(t('errCoverFile'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      setValue(await uploadFile(file, 'tutor-file-covers'))
    } catch {
      setError(t('errUpload', { name: file.name }))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await filesFetch(`/api/tutor-files/folders/${folder.id}`, jsonInit('PATCH', { cover: value }))
      onSaved()
    } catch {
      setError(t('errGeneric'))
      setBusy(false)
    }
  }

  const swatch = (preset: CoverPreset) => {
    const id = `${PRESET_PREFIX}${preset.id}`
    const selected = value === id
    return (
      <button
        key={preset.id}
        type="button"
        className={`${styles.swatch} ${selected ? styles.selected : ''}`}
        onClick={() => setValue(id)}
        aria-label={preset.id}
        aria-pressed={selected}
      >
        <FolderShape folderId={folder.id} cover={id} className={styles.swatchShape}>
          {selected && <span className={styles.tick}><FilesCheckIcon size={12} strokeWidth={3} /></span>}
        </FolderShape>
      </button>
    )
  }

  const isImage = !!value && !value.startsWith(PRESET_PREFIX)

  return (
    <FilesModal
      size="wide"
      title={t('coverTitle')}
      closeLabel={t('close')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.btn} onClick={() => setValue(null)} disabled={busy || value === null}>{t('coverReset')}</button>
          <span className={styles.footerSpacer} />
          <button type="button" className={ui.btn} onClick={e => { e.stopPropagation(); onClose() }}>{t('cancel')}</button>
          <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={save} disabled={busy || value === folder.cover}>{t('save')}</button>
        </>
      }
    >
      <div className={styles.preview}>
        <FolderShape folderId={folder.id} cover={value}>
          <div className={styles.previewName}>{folder.name}</div>
        </FolderShape>
      </div>

      <div className={styles.label}>{t('coverPastel')}</div>
      <div className={styles.grid}>{PASTEL_PRESETS.map(swatch)}</div>

      <div className={styles.label}>{t('coverArt')}</div>
      <div className={styles.grid}>{ART_PRESETS.map(swatch)}</div>

      <div className={styles.label}>{t('coverOwn')}</div>
      <button type="button" className={`${styles.upload} ${isImage ? styles.uploadActive : ''}`} onClick={() => inputRef.current?.click()} disabled={busy}>
        <FilesUploadIcon size={16} />
        <span>{isImage ? t('coverUploaded') : t('coverUpload')}</span>
        <span className={styles.uploadHint}>{t('coverUploadHint')}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { onUpload(e.target.files?.[0]); e.target.value = '' }} />
      {error && <div className={ui.error} role="alert">{error}</div>}
    </FilesModal>
  )
}
