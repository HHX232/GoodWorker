'use client'

import type { Editor } from '@tiptap/core'
import { CropIcon, ImageIcon, Loader2Icon, ScanTextIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { docText } from './docOps'
import { photoFailedToast, photoNode, preparePhoto, readPhotoContent, uploadPhoto, type PreparedPhoto } from './photoTools'
import styles from './LectureEditor.module.scss'

interface Props {
  lectureId: string
  editor: Editor
  file: File
  /** Where the content goes — right after the block the selection ended in. */
  at: number
  onClose: () => void
}

/** "Вставить с фото": preview (optionally cropped to the sheet), then insert the photo and/or its recognised content. */
export function InsertPhotoDialog({ lectureId, editor, file, at, onClose }: Props) {
  const t = useTranslations('lecture')
  // Kept in refs: an inline onClose from the parent must not restart the photo preparation.
  const closeRef = useRef(onClose)
  const tRef = useRef(t)
  useEffect(() => { closeRef.current = onClose; tRef.current = t }, [onClose, t])
  const [crop, setCrop] = useState(true)
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [insertImage, setInsertImage] = useState(true)
  const [recognise, setRecognise] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    setPrepared(null)
    preparePhoto(file, crop).then(p => {
      if (cancelled) return
      url = URL.createObjectURL(p.file)
      setPrepared(p)
      setPreview(url)
    }).catch(() => {
      // HEIC on desktop / a broken file — say what's wrong instead of spinning forever.
      if (cancelled) return
      toast.error(tRef.current('photoErr_UNREADABLE'))
      closeRef.current()
    })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [file, crop])

  const insert = async () => {
    if (!prepared || (!insertImage && !recognise)) return
    setBusy(true)
    try {
      const context = docText(editor.state.doc, at - 1500, at + 500)
      const [photoId, blocks] = await Promise.all([
        insertImage ? uploadPhoto(lectureId, prepared) : Promise.resolve(null),
        recognise ? readPhotoContent(lectureId, prepared.file, context) : Promise.resolve([]),
      ])
      const content = [...(photoId ? [photoNode(photoId, prepared)] : []), ...blocks]
      if (!content.length) { toast.message(t('photoNothing')); setBusy(false); return }
      editor.chain().focus().insertContentAt(Math.min(at, editor.state.doc.content.size), content).run()
      if (recognise && !blocks.length) toast.message(t('photoNothing'))
      onClose()
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'VIP_REQUIRED' || code === 'QUOTA_EXCEEDED') toast.error(code === 'VIP_REQUIRED' ? t('vipOnly') : t('quotaExceeded'))
      else photoFailedToast({ message: t('photoFailed'), retryLabel: t('photoRetry'), retry: () => { void insertRef.current() } })
      setBusy(false)
    }
  }  // «Повторить» in the notice calls the latest insert (fresh state), not the failed closure.
  const insertRef = useRef(insert)
  useEffect(() => { insertRef.current = insert })


  return createPortal(
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className={`${styles.dialog} ${styles.photoDialog}`} role="dialog" aria-label={t('insertFromPhoto')}>
        <div className={styles.dialogTitle}>{t('insertFromPhoto')}</div>
        <div className={styles.photoPreview}>
          {preview && prepared
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={preview} alt="" />
            : <span className={styles.photoPreviewBusy}><Loader2Icon size={20} className="lecture-spin" /> {crop ? t('cropping') : t('preparing')}</span>}
          {prepared && crop && !prepared.cropped && <span className={styles.photoBadge}>{t('cropNotFound')}</span>}
          {prepared?.cropped && <span className={`${styles.photoBadge} ${styles.photoBadgeOk}`}><CropIcon size={12} /> {t('cropApplied')}</span>}
        </div>
        <div className={styles.optionList}>
          <label className={styles.option}><input type="checkbox" checked={crop} onChange={e => setCrop(e.target.checked)} disabled={busy} /><CropIcon size={15} /> {t('cropSheet')}</label>
          <label className={styles.option}><input type="checkbox" checked={insertImage} onChange={e => setInsertImage(e.target.checked)} disabled={busy} /><ImageIcon size={15} /> {t('optInsertImage')}</label>
          <label className={styles.option}><input type="checkbox" checked={recognise} onChange={e => setRecognise(e.target.checked)} disabled={busy} /><ScanTextIcon size={15} /> {t('optRecognise')}</label>
        </div>
        <div className={styles.dialogActions}>
          <span className={styles.spacer} />
          <button type="button" className={styles.btn} onClick={onClose} disabled={busy}>{t('cancel')}</button>
          <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={insert} disabled={busy || !prepared || (!insertImage && !recognise)}>
            {busy ? <><Loader2Icon size={15} className="lecture-spin" /> {t('aiThinking')}</> : t('insert')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
