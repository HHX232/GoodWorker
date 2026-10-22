'use client'

import { defaultSpineColor } from '@/shared/lib/tutorFiles/bookModel'
import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import { TriangleAlert } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { FilesCheckIcon, FilesCoverIcon, FilesUploadIcon, FilesUndoIcon } from '../icons'
import { formatBytes } from '../lib'
import ui from '../ui.module.scss'
import { BookCover } from './BookCover'
import { checkBookCover, FilesApiError, uploadBook, type CoverCheckResult, type CoverCheck } from './bookFetch'
import { BookModal } from './BookModal'
import { CoverEditor, SpineColorPicker, type CoverValue } from './CoverEditor'
import { blobToDataUrl } from './coverCanvas'
import { renderPdfFirstPage } from './renderPdfFirstPage'
import styles from './BookUploadModal.module.scss'

export interface BookUploadModalProps {
  open: boolean
  onClose: () => void
  /** The book is created; the modal closes itself right after this. */
  onUploaded: (book: LibraryBook) => void
  /** A PDF the caller already picked (skips the drop zone and goes straight to the check). */
  initialFile?: File | null
}

type Step = 'pick' | 'checking' | 'result' | 'edit' | 'confirm'
type Verdict = CoverCheck | 'idle'

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const titleOf = (name: string) => name.replace(/\.pdf$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
const STEP_INDEX: Record<Step, number> = { pick: 0, checking: 1, result: 2, edit: 2, confirm: 3 }

/** Upload a PDF as a book: first page → vision check → cover result → (cover editor) → name → upload. */
export function BookUploadModal({ open, onClose, onUploaded, initialFile }: BookUploadModalProps) {
  if (!open) return null
  return <UploadFlow onClose={onClose} onUploaded={onUploaded} initialFile={initialFile ?? null} />
}

function UploadFlow({ onClose, onUploaded, initialFile }: { onClose: () => void; onUploaded: (book: LibraryBook) => void; initialFile: File | null }) {
  const t = useTranslations('files')
  const locale = useLocale()
  const [step, setStep] = useState<Step>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [pageThumb, setPageThumb] = useState<string | null>(null)
  const [page1, setPage1] = useState<{ blob: Blob; previewUrl: string } | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<Verdict>('idle')
  const [cover, setCover] = useState<CoverValue>({ spineColor: defaultSpineColor(''), image: null })
  const [photo, setPhoto] = useState<File | null>(null)
  // The cover editor stays mounted once opened (hidden on other steps) so the photo and its sliders survive Back → editor; a new PDF starts a fresh one.
  const [editorSeen, setEditorSeen] = useState(false)
  const [fileSeq, setFileSeq] = useState(0)
  const [pickError, setPickError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  const pdfInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const run = useRef(0) // bumps on cancel / a new file — a late answer from the old run is dropped
  const abort = useRef<AbortController | null>(null)
  const colorTouched = useRef(false) // the user chose a colour — the model's suggestion no longer overrides it
  const uploaded = useRef(false) // POST /books succeeded — never upload again from this modal

  useEffect(() => () => { run.current++; abort.current?.abort() }, [])

  const check = async (f: File) => {
    const id = ++run.current
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setStep('checking')
    setVerdict('idle')
    setPageThumb(null)
    setPage1(null)
    let first: Awaited<ReturnType<typeof renderPdfFirstPage>> | null = null
    try {
      first = await renderPdfFirstPage(f, { signal: ctrl.signal })
    } catch {
      first = null // broken / protected PDF (or cancelled): nothing to look at — "could not check"
    }
    if (run.current !== id) return
    // Anything that fails from here on (FileReader, the request) ends in "could not check", never in an endless "checking".
    let ready: { blob: Blob; previewUrl: string } | null = null
    let checked: CoverCheckResult = { verdict: 'unavailable' }
    try {
      if (first) {
        const [thumb, coverUrl] = await Promise.all([blobToDataUrl(first.page), blobToDataUrl(first.cover)])
        if (run.current !== id) return
        ready = { blob: first.cover, previewUrl: coverUrl }
        setPageThumb(thumb)
        setPage1(ready)
        setNumPages(first.numPages)
        checked = await checkBookCover(first.page, ctrl.signal)
      } else {
        setNumPages(null)
      }
    } catch {
      checked = { verdict: 'unavailable' }
      ready = null
    }
    if (run.current !== id) return
    const found = ready
    const { verdict: result, spineColor } = checked
    setVerdict(result)
    setCover(c => ({
      spineColor: spineColor && !colorTouched.current ? spineColor : c.spineColor,
      image: result === 'cover' && found ? { kind: 'found', previewUrl: found.previewUrl, getBlob: async () => found.blob } : null,
    }))
    setStep('result')
  }

  const pickPdf = (f: File | undefined) => {
    if (!f) return
    if (!isPdf(f)) { setPickError(t('booksKitNotPdf', { name: f.name })); return }
    const name = titleOf(f.name) || f.name
    setPickError(null)
    colorTouched.current = false
    setPhoto(null)
    setEditorSeen(false)
    setFileSeq(n => n + 1)
    setFile(f)
    setTitle(name)
    setCover({ spineColor: defaultSpineColor(name), image: null })
    void check(f)
  }

  useEffect(() => { if (initialFile) pickPdf(initialFile) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () => {
    run.current++
    abort.current?.abort()
    onClose()
  }

  const usePage = () => {
    if (!page1) return
    setCover(c => ({ ...c, image: { kind: 'page1', previewUrl: page1.previewUrl, getBlob: async () => page1.blob } }))
    setStep('confirm')
  }

  const goEdit = () => { setEditorSeen(true); setStep('edit') }

  const pickPhoto = (f: File | undefined) => {
    if (!f) return
    setPhoto(f)
    goEdit()
  }

  const submit = async () => {
    if (!file || uploading || uploaded.current) return
    setUploading(true)
    setUploadError(null)
    const fail = (text: string) => { setUploadError(text); toast.error(text); setUploading(false) }
    let blob: Blob | null = null
    if (cover.image?.getBlob) {
      try {
        blob = await cover.image.getBlob()
      } catch {
        fail(t('booksKitCoverRenderFailed'))
        return
      }
    }
    let book: LibraryBook
    try {
      book = (await uploadBook({
        file,
        title: title.trim() || titleOf(file.name) || file.name,
        spineColor: cover.spineColor,
        pageCount: numPages,
        cover: cover.image && blob ? { blob, kind: cover.image.kind } : null,
      })).book
    } catch (e) {
      const code = e instanceof FilesApiError ? e.code : ''
      fail(
        code === 'VIP_REQUIRED' ? t('errVip')
        : code === 'QUOTA_EXCEEDED' ? t('errQuota')
        : code === 'FILE_TOO_LARGE' ? t('errTooLarge', { name: file.name })
        : code === 'NOT_PDF' ? t('booksKitNotPdf', { name: file.name })
        : code === 'COVER_TOO_LARGE' || code === 'COVER_INVALID' ? t('booksKitCoverRejected')
        : t('errUpload', { name: file.name }),
      )
      return
    }
    // The book exists now: a failing callback must not bring the upload button back (a retry would create a duplicate).
    uploaded.current = true
    try { onUploaded(book) } catch (e) { console.error('[BookUploadModal] onUploaded failed', e) }
    onClose()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    pickPdf(e.dataTransfer.files?.[0])
  }

  const dots = (
    <span className={styles.steps} aria-hidden="true">
      {[0, 1, 2, 3].map(i => <i key={i} className={i <= STEP_INDEX[step] ? styles.on : undefined} />)}
    </span>
  )

  const preview = { title: title || (file ? titleOf(file.name) : ''), spineColor: cover.spineColor, coverUrl: cover.image?.previewUrl ?? null, coverKind: cover.image?.kind ?? null }
  const sizeLine = file ? [numPages ? t('booksKitPagesShort', { pages: numPages }) : null, formatBytes(file.size, locale), 'PDF'].filter(Boolean).join(' · ') : ''

  let body: React.ReactNode
  let footer: React.ReactNode
  let heading: string = t('booksKitUploadTitle')

  if (step === 'pick') {
    body = (
      <>
        <div
          className={`${styles.dz} ${over ? styles.over : ''}`}
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <FilesUploadIcon size={36} strokeWidth={1.6} />
          <h3>{t('booksKitDropTitle')}</h3>
          <p>{t('booksKitDropText')}</p>
          <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => pdfInput.current?.click()} data-autofocus>{t('booksKitPickPdf')}</button>
        </div>
        {pickError && <div className={ui.error} role="alert">{pickError}</div>}
      </>
    )
    footer = (<>{dots}<button type="button" className={ui.btn} onClick={cancel}>{t('cancel')}</button></>)
  } else if (step === 'checking') {
    heading = t('booksKitCheckTitle')
    body = (
      <div className={styles.chk}>
        <div className={styles.pg} aria-hidden="true">
          {pageThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pageThumb} alt="" />
          ) : (
            <span className={styles.skel} />
          )}
          <div className={styles.scan} />
        </div>
        <div role="status">
          <h3>{t('booksKitChecking')}</h3>
          <p>{t('booksKitCheckingText')}</p>
          <div className={styles.indet} aria-hidden="true"><i /></div>
          <p className={styles.fn}>{file?.name}{file ? ` · ${formatBytes(file.size, locale)}` : ''}</p>
        </div>
      </div>
    )
    footer = (<>{dots}<button type="button" className={ui.btn} onClick={cancel} data-autofocus>{t('booksKitCancelUpload')}</button></>)
  } else if (step === 'result') {
    heading = t('booksKitCheckTitle')
    const found = verdict === 'cover'
    const unavailable = verdict === 'unavailable'
    body = (
      <div className={styles.res}>
        <div className={styles.pv}>
          {!found && pageThumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.pgc} src={pageThumb} alt={t('booksKitPageAlt')} />
          )}
          <BookCover {...preview} size="lg" />
        </div>
        <div>
          <h3 className={found ? styles.ok : styles.warn}>
            {found ? <FilesCheckIcon size={24} strokeWidth={2.4} aria-hidden /> : <TriangleAlert size={24} aria-hidden />}
            <span>{found ? t('booksKitFoundTitle') : unavailable ? t('booksKitUnavailTitle') : t('booksKitPlainTitle')}</span>
          </h3>
          <p>{found ? t('booksKitFoundText') : unavailable ? t('booksKitUnavailText') : t('booksKitPlainText')}</p>
          <div className={styles.btns}>
            {found ? (
              <>
                <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => setStep('confirm')} data-autofocus>{t('booksKitUse')}</button>
                <button type="button" className={ui.btn} onClick={goEdit}>{t('booksKitUseOther')}</button>
              </>
            ) : (
              <>
                <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => photoInput.current?.click()} data-autofocus><FilesCoverIcon size={16} />{t('booksKitPhoto')}</button>
                <button type="button" className={ui.btn} onClick={goEdit}>{t('booksKitPickColor')}</button>
                {page1 && <button type="button" className={ui.btn} onClick={usePage}>{t('booksKitUsePage')}</button>}
                {unavailable && file && <button type="button" className={ui.btn} onClick={() => void check(file)}><FilesUndoIcon size={16} />{t('booksKitRetry')}</button>}
              </>
            )}
          </div>
          <div className={styles.colors}>
            <span className={styles.lbl}>{t('booksKitColorTitle')}</span>
            <SpineColorPicker value={cover.spineColor} onChange={c => { colorTouched.current = true; setCover(v => ({ ...v, spineColor: c })) }} />
          </div>
        </div>
      </div>
    )
    footer = (<>{dots}<button type="button" className={ui.btn} onClick={cancel}>{t('booksKitCancelUpload')}</button></>)
  } else if (step === 'edit') {
    heading = t('booksKitEditTitle')
    body = null
    footer = (
      <>
        {dots}
        <button type="button" className={ui.btn} onClick={() => setStep('result')}>{t('booksKitBack')}</button>
        <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={() => setStep('confirm')} data-autofocus>{t('booksKitDone')}</button>
      </>
    )
  } else {
    heading = t('booksKitConfirmTitle')
    body = (
      <div className={styles.res}>
        <div className={styles.pv}><BookCover {...preview} size="lg" /></div>
        <div>
          <label className={styles.lbl} htmlFor="book-title">{t('booksKitNameLabel')}</label>
          <input id="book-title" className={ui.input} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} disabled={uploading} />
          <p className={styles.sizeLine}>{sizeLine}</p>
          {uploadError && <div className={ui.error} role="alert">{uploadError}</div>}
        </div>
      </div>
    )
    footer = (
      <>
        {dots}
        <button type="button" className={ui.btn} onClick={() => setStep('result')} disabled={uploading}>{t('booksKitBack')}</button>
        <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={submit} disabled={uploading || !title.trim()} data-autofocus>
          {uploading ? <><span className={styles.spin} />{t('booksKitUploading')}</> : <><FilesUploadIcon size={16} />{t('booksKitSubmit')}</>}
        </button>
      </>
    )
  }

  return (
    <BookModal title={heading} closeLabel={t('close')} onClose={cancel} locked={uploading} footer={footer} focusKey={step}>
      {body}
      {editorSeen && (
        <div style={step === 'edit' ? undefined : { display: 'none' }}>
          <CoverEditor key={fileSeq} title={preview.title} value={cover} onChange={setCover} onColorPick={() => { colorTouched.current = true }} loadPage1={page1 ? async () => page1 : undefined} initialPhoto={photo} />
        </div>
      )}
      <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={e => { pickPdf(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
    </BookModal>
  )
}
