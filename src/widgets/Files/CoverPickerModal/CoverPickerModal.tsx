'use client'

import { ART_PRESETS, MAX_COVER_BYTES, PASTEL_PRESETS, PHOTO_PRESETS, PRESET_PREFIX, type CoverPreset } from '@/shared/lib/tutorFiles/covers'
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

/** The preset swatches (pastel / artwork / landscapes), shared by the cover picker and the create-folder dialog. */
export function CoverPresetGrid({ folderId, value, onChange }: { folderId: string; value: string | null; onChange: (v: string) => void }) {
  const t = useTranslations('files')
  const section = (label: string, presets: CoverPreset[]) => (
    <>
      <div className={styles.label}>{label}</div>
      <div className={styles.grid}>
        {presets.map(preset => {
          const id = `${PRESET_PREFIX}${preset.id}`
          const selected = value === id
          return (
            <button key={preset.id} type="button" className={`${styles.swatch} ${selected ? styles.selected : ''}`} onClick={() => onChange(id)} aria-label={preset.id} aria-pressed={selected}>
              <FolderShape folderId={folderId} cover={id} className={styles.swatchShape}>
                {selected && <span className={styles.tick}><FilesCheckIcon size={12} strokeWidth={3} /></span>}
              </FolderShape>
            </button>
          )
        })}
      </div>
    </>
  )
  return (
    <>
      {section(t('coverPastel'), PASTEL_PRESETS)}
      {section(t('coverArt'), ART_PRESETS)}
      {section(t('coverPhotos'), PHOTO_PRESETS)}
    </>
  )
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

      <CoverPresetGrid folderId={folder.id} value={value} onChange={setValue} />

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
