'use client'

import { uploadFile } from '@/shared/lib/uploadFile'
import type { FileReview, LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AnnotatedPages, type AnnotatedPagesHandle } from '../AnnotatedPages/AnnotatedPages'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesEraserIcon, FilesPenIcon, FilesUndoIcon, FilesUploadIcon } from '../icons'
import { filesFetch, jsonInit, viewerFor } from '../lib'
import ui from '../ui.module.scss'
import styles from './ReviewModal.module.scss'

const PEN_COLORS = ['#E5484D', '#1F9D55', '#2E6FE0'] as const
const PEN_WIDTH = 0.004

/**
 * Two things happen here, sharing one canvas:
 * - Reviewing a student's submission (idea 1): pen marks on the pages (PDF
 *   via pdf.js, images), a verdict — accepted / needs revision — an optional
 *   grade and comment. Marks upload as transparent PNG layers; the student
 *   sees them over the same pages and gets a chat card when the verdict
 *   changes. Other file types get the verdict panel without the pen.
 * - Plain PDF editing: opening any PDF the tutor manages lands here too
 *   (FilesShell.openPreview), pen tools only, no verdict — a grade/comment
 *   panel makes no sense on your own file. `isSubmission` is what tells the
 *   two apart, straight from data already on hand, not a prop.
 */
export function ReviewModal({ file, onClose, onSaved, onReupload }: {
  file: LibraryFile
  onClose: () => void
  onSaved: (review: FileReview) => void
  /** Uploads a file into the same folder as `file` (reuses FilesShell's own upload — quota/VIP/toasts included). Resolves to whether it made it in. */
  onReupload: (file: File) => Promise<boolean>
}) {
  const t = useTranslations('files')
  const viewer = viewerFor(file.mimeType, file.name)
  const drawable = viewer === 'pdf' || viewer === 'image'
  const isSubmission = file.uploadedByRole === 'STUDENT'
  const pagesRef = useRef<AnnotatedPagesHandle>(null)
  const [color, setColor] = useState<string>(PEN_COLORS[0])
  // Off by default: this now opens on a plain click (FilesShell.openPreview),
  // so a casual "just looking" open must not draw on the first drag.
  const [penOn, setPenOn] = useState(false)
  const [status, setStatus] = useState<FileReview['status'] | null>(file.review?.status ?? null)
  const [grade, setGrade] = useState(file.review?.grade ?? '')
  const [comment, setComment] = useState(file.review?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [reuploading, setReuploading] = useState(false)
  const [hasMarks, setHasMarks] = useState(false)
  const onChange = useCallback(() => setHasMarks(pagesRef.current?.hasChanges() ?? false), [])
  const [renderFailed, setRenderFailed] = useState(false)
  const onError = useCallback(() => setRenderFailed(true), [])

  const source = useMemo(() => viewer === 'pdf'
    ? { kind: 'pdf' as const, contentUrl: `/api/tutor-files/files/${file.id}/content` }
    : { kind: 'image' as const, url: file.url }, [viewer, file.id, file.url])

  const save = async () => {
    if (!status) return
    setSaving(true)
    try {
      let annotations: { page: number; url: string }[] | undefined
      const pages = pagesRef.current
      if (pages?.hasChanges()) {
        const blobs = await pages.exportStrokes()
        const uploaded = await Promise.all(blobs.map(async ({ page, blob }) => ({
          page,
          url: await uploadFile(new File([blob], `review-${file.id}-p${page}.png`, { type: 'image/png' }), 'tutor-file-reviews'),
        })))
        annotations = [...pages.keptLayers(), ...uploaded]
      }
      const { review } = await filesFetch<{ review: FileReview }>(`/api/tutor-files/files/${file.id}/review`, jsonInit('PUT', { status, grade, comment, annotations }))
      toast.success(t('reviewSaved'))
      onSaved(review)
    } catch (e) {
      console.error('[ReviewModal] save failed', e)
      toast.error(t('errGeneric'))
    } finally {
      setSaving(false)
    }
  }

  // Bakes this session's pen marks straight into the PDF's pages (pdf-lib) and
  // drops the result next to the original via the same upload FilesShell
  // already uses — no download/re-upload round trip. Marks saved in an
  // earlier review (`layers`) are not re-flattened here: they were uploaded
  // as separate PNGs, and pulling them back through a <canvas> would taint it
  // without guaranteed CORS headers on the bucket (see spec §2).
  const uploadCorrected = async () => {
    const pages = pagesRef.current
    if (!pages?.hasChanges()) return
    setReuploading(true)
    try {
      const marks = await pages.exportStrokes()
      const res = await fetch(`/api/tutor-files/files/${file.id}/content`)
      if (!res.ok) throw new Error(String(res.status))
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(await res.arrayBuffer())
      for (const { page, blob } of marks) {
        const pdfPage = pdfDoc.getPage(page - 1)
        const png = await pdfDoc.embedPng(await blob.arrayBuffer())
        pdfPage.drawImage(png, { x: 0, y: 0, width: pdfPage.getWidth(), height: pdfPage.getHeight() })
      }
      const bytes = await pdfDoc.save()
      const name = `(${t('reuploadPrefix')}) ${file.name.replace(/\.pdf$/i, '')}.pdf`
      // uploadFiles already shows its own toast on failure (quota/VIP/etc) — a
      // second, generic one here would just contradict it.
      const ok = await onReupload(new File([bytes.slice().buffer], name, { type: 'application/pdf' }))
      if (ok) toast.success(t('reuploadDone'))
    } catch (e) {
      console.error('[ReviewModal] reupload failed', e)
      toast.error(t('errGeneric'))
    } finally {
      setReuploading(false)
    }
  }

  return (
    <FilesModal
      size="viewer"
      closeLabel={t('close')}
      onClose={onClose}
      title={<span className={styles.title}>{isSubmission ? t('reviewTitle') : t('editTitle')} · <span className={styles.name}>{file.name}</span></span>}
    >
      <div className={`${styles.layout} ${!isSubmission ? styles.layoutSolo : ''}`}>
        <div className={styles.stage}>
          {drawable && !renderFailed ? (
            <>
              <div className={styles.toolbar} role="toolbar" aria-label={t('reviewPen')}>
                <button type="button" className={`${styles.tool} ${penOn ? styles.toolOn : ''}`} onClick={() => setPenOn(v => !v)} aria-pressed={penOn} title={t('reviewPen')}>
                  <FilesPenIcon size={16} />
                </button>
                {PEN_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.swatch} ${color === c && penOn ? styles.swatchOn : ''}`}
                    style={{ background: c }}
                    onClick={() => { setColor(c); setPenOn(true) }}
                    aria-label={c}
                    aria-pressed={color === c}
                  />
                ))}
                <span className={styles.sep} />
                <button type="button" className={styles.tool} onClick={() => pagesRef.current?.undo()} title={t('reviewUndo')} aria-label={t('reviewUndo')}><FilesUndoIcon size={16} /></button>
                <button type="button" className={styles.tool} onClick={() => pagesRef.current?.clearAll()} title={t('reviewClear')} aria-label={t('reviewClear')}><FilesEraserIcon size={16} /></button>
                {viewer === 'pdf' && hasMarks && (
                  <>
                    <span className={styles.sep} />
                    <button type="button" className={styles.reupload} disabled={reuploading} onClick={uploadCorrected}>
                      <FilesUploadIcon size={16} />
                      {reuploading ? t('saving') : t('reuploadButton')}
                    </button>
                  </>
                )}
              </div>
              <AnnotatedPages
                ref={pagesRef}
                source={source}
                layers={file.review?.annotations ?? []}
                pen={penOn ? { color, width: PEN_WIDTH } : null}
                onChange={onChange}
                onError={onError}
              />
            </>
          ) : (
            <p className={styles.noPen}>{t('reviewNoPen')}</p>
          )}
        </div>

        {isSubmission && (
          <aside className={styles.panel}>
            <div className={styles.label}>{t('reviewVerdict')}</div>
            <div className={styles.verdicts}>
              <button type="button" className={`${styles.verdict} ${status === 'ACCEPTED' ? styles.accepted : ''}`} onClick={() => setStatus('ACCEPTED')} aria-pressed={status === 'ACCEPTED'}>{t('reviewAccepted')}</button>
              <button type="button" className={`${styles.verdict} ${status === 'REVISION' ? styles.revision : ''}`} onClick={() => setStatus('REVISION')} aria-pressed={status === 'REVISION'}>{t('reviewRevision')}</button>
            </div>
            <label className={styles.label} htmlFor="review-grade">{t('reviewGrade')}</label>
            <input id="review-grade" className={ui.input} value={grade} maxLength={20} onChange={e => setGrade(e.target.value)} placeholder={t('reviewGradePlaceholder')} />
            <label className={styles.label} htmlFor="review-comment">{t('reviewComment')}</label>
            <textarea id="review-comment" className={`${ui.input} ${styles.comment}`} value={comment} maxLength={4000} onChange={e => setComment(e.target.value)} rows={5} />
            <p className={styles.hint}>{t('reviewNotifyHint')}</p>
            <button type="button" className={`${ui.btn} ${ui.primary} ${styles.save}`} disabled={!status || saving} onClick={save}>
              {saving ? t('saving') : t('reviewSave')}
            </button>
          </aside>
        )}
      </div>
    </FilesModal>
  )
}
