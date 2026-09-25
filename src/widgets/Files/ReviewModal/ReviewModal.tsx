'use client'

import { uploadFile } from '@/shared/lib/uploadFile'
import type { FileReview, LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AnnotatedPages, type AnnotatedPagesHandle } from '../AnnotatedPages/AnnotatedPages'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesEraserIcon, FilesPenIcon, FilesUndoIcon } from '../icons'
import { filesFetch, jsonInit, viewerFor } from '../lib'
import ui from '../ui.module.scss'
import styles from './ReviewModal.module.scss'

const PEN_COLORS = ['#E5484D', '#1F9D55', '#2E6FE0'] as const
const PEN_WIDTH = 0.004

/**
 * The tutor checks a student's submission (idea 1): pen marks right on the
 * pages (PDF via pdf.js, images), a verdict — accepted / needs revision — an
 * optional grade and comment. Marks are uploaded as transparent PNG layers;
 * the student sees them over the same pages and gets a chat card when the
 * verdict changes. Other file types get the verdict panel without the pen.
 */
export function ReviewModal({ file, onClose, onSaved }: {
  file: LibraryFile
  onClose: () => void
  onSaved: (review: FileReview) => void
}) {
  const t = useTranslations('files')
  const viewer = viewerFor(file.mimeType, file.name)
  const drawable = viewer === 'pdf' || viewer === 'image'
  const pagesRef = useRef<AnnotatedPagesHandle>(null)
  const [color, setColor] = useState<string>(PEN_COLORS[0])
  const [penOn, setPenOn] = useState(true)
  const [status, setStatus] = useState<FileReview['status'] | null>(file.review?.status ?? null)
  const [grade, setGrade] = useState(file.review?.grade ?? '')
  const [comment, setComment] = useState(file.review?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [, bump] = useState(0)
  const onChange = useCallback(() => bump(n => n + 1), [])
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

  return (
    <FilesModal
      size="viewer"
      closeLabel={t('close')}
      onClose={onClose}
      title={<span className={styles.title}>{t('reviewTitle')} · <span className={styles.name}>{file.name}</span></span>}
    >
      <div className={styles.layout}>
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
      </div>
    </FilesModal>
  )
}
