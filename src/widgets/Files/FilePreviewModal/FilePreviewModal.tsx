'use client'

import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnnotatedPages } from '../AnnotatedPages/AnnotatedPages'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesDownloadIcon } from '../icons'
import { fileKind, formatBytes, formatDeadline, KIND_COLOR, KIND_ICON, viewerFor, type ViewerKind } from '../lib'
import ui from '../ui.module.scss'
import styles from './FilePreviewModal.module.scss'

const MAX_TEXT_CHARS = 400_000
const MAX_ROWS = 2000

interface Sheet { name: string; rows: string[][] }

type Parsed =
  | { kind: 'text'; text: string; truncated: boolean }
  | { kind: 'sheets'; sheets: Sheet[] }
  | { kind: 'docx'; buf: ArrayBuffer }

/** `A`, `B`, … `AA` — spreadsheet column headers. */
function colName(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/**
 * Bytes come through our API (access-checked, no CORS dependency on the
 * bucket). The heavy parsers are dynamic imports — SheetJS and docx-preview
 * download only when a spreadsheet / Word file is actually opened.
 */
async function loadParsed(file: LibraryFile, viewer: ViewerKind, locale: string, contentUrl: string): Promise<Parsed> {
  const res = await fetch(contentUrl)
  if (!res.ok) throw new Error(String(res.status))
  const buf = await res.arrayBuffer()
  if (viewer === 'docx') return { kind: 'docx', buf }
  if (viewer === 'sheet') {
    const XLSX = await import('xlsx')
    const isCsv = file.name.toLowerCase().endsWith('.csv')
    // CSV is decoded as UTF-8 text first — handed over as bytes SheetJS would guess a legacy codepage and garble Cyrillic.
    const wb = isCsv ? XLSX.read(new TextDecoder().decode(buf), { type: 'string' }) : XLSX.read(buf, { type: 'array', cellDates: true })
    const sheets = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name]
      if (!ws['!ref']) return { name, rows: [] }
      const range = XLSX.utils.decode_range(ws['!ref'])
      const rows: string[][] = []
      for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + MAX_ROWS - 1); r++) {
        const row: string[] = []
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })]
          // Dates in the viewer's locale; otherwise Excel's own formatted text;
          // a formula saved without a cached value shows as the formula.
          row.push(!cell ? ''
            : cell.t === 'd' && cell.v instanceof Date ? cell.v.toLocaleDateString(locale)
              : cell.w || (cell.v !== undefined && cell.v !== '' ? String(cell.v) : cell.f ? `=${cell.f}` : ''))
        }
        rows.push(row)
      }
      return { name, rows }
    })
    return { kind: 'sheets', sheets }
  }
  const text = new TextDecoder().decode(buf)
  return { kind: 'text', text: text.slice(0, MAX_TEXT_CHARS), truncated: text.length > MAX_TEXT_CHARS }
}

/** docx-preview renders into a DOM node (with the document's own styles, images and page breaks). */
function DocxView({ buf, onError }: { buf: ArrayBuffer; onError: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    import('docx-preview')
      .then(({ renderAsync }) => {
        if (cancelled) return
        el.innerHTML = ''
        return renderAsync(buf, el, el, { className: 'gw-docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, useBase64URL: true })
      })
      .catch(e => {
        console.error('[FilePreviewModal] docx render failed', e)
        if (!cancelled) onError()
      })
    return () => { cancelled = true }
  }, [buf, onError])
  return <div className={styles.docxWrap} ref={ref} />
}

function SheetView({ sheets }: { sheets: Sheet[] }) {
  const [active, setActive] = useState(0)
  const sheet = sheets[active]
  const width = sheet?.rows[0]?.length ?? 0
  return (
    <div className={styles.sheetWrap}>
      <div className={styles.sheetScroll}>
        <table className={styles.sheet}>
          <thead>
            <tr><th />{Array.from({ length: width }, (_, c) => <th key={c}>{colName(c)}</th>)}</tr>
          </thead>
          <tbody>
            {sheet?.rows.map((row, r) => (
              <tr key={r}><th>{r + 1}</th>{row.map((cell, c) => <td key={c} className={/^-?[\d\s]+([.,]\d+)?%?$/.test(cell) ? styles.num : undefined}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheets.length > 1 && (
        <div className={styles.tabs}>
          {sheets.map((s, i) => (
            <button key={s.name + i} type="button" className={`${styles.tab} ${i === active ? styles.tabActive : ''}`} onClick={() => setActive(i)}>{s.name}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The in-app viewer (G05, extended): PDF in the browser's own viewer, images,
 * video and audio with native players, text files, spreadsheets and Word
 * documents. Other types (pptx, archives, old .doc, …)
 * show a download card. Opening here never posts anything to the chat.
 * Spreadsheets (xlsx/xls/ods/csv via SheetJS) and Word (docx-preview) load
 * their libraries lazily, on first open of such a file.
 */
export function FilePreviewModal({ file, onClose, onDownload, contentUrl }: {
  file: LibraryFile
  onClose: () => void
  onDownload: () => void
  /** Where the viewer reads bytes from (admin view / shared-folder links override the default). */
  contentUrl?: string
}) {
  const t = useTranslations('files')
  const locale = useLocale()
  const viewer = viewerFor(file.mimeType, file.name)
  const kind = fileKind(file.mimeType, file.name)
  const Icon = KIND_ICON[kind]
  const parsedViewer = viewer === 'text' || viewer === 'sheet' || viewer === 'docx'
  const [renderFailed, setRenderFailed] = useState(false)
  const onRenderError = useCallback(() => setRenderFailed(true), [])

  const parsed = useQuery({
    queryKey: ['tutor-files', 'content', file.id, contentUrl],
    queryFn: () => loadParsed(file, viewer!, locale, contentUrl ?? `/api/tutor-files/files/${file.id}/content`),
    enabled: parsedViewer,
    retry: false,
    staleTime: 5 * 60_000,
  })

  // The tutor's pen marks (idea 1) are drawn over the pages, so a marked
  // PDF/image renders through pdf.js instead of the browser's own viewer.
  const review = file.review
  const marked = !!review && review.annotations.length > 0 && (viewer === 'pdf' || viewer === 'image') && !renderFailed
  const url = contentUrl ?? `/api/tutor-files/files/${file.id}/content`
  const source = useMemo(() => viewer === 'pdf'
    ? { kind: 'pdf' as const, contentUrl: url }
    : { kind: 'image' as const, url: file.url }, [viewer, url, file.url])

  let stage: ReactNode
  if (marked) {
    stage = <div className={styles.markedWrap}><AnnotatedPages source={source} layers={review.annotations} onError={onRenderError} /></div>
  } else if (viewer === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    stage = <img src={file.url} alt={file.name} className={styles.image} />
  } else if (viewer === 'pdf') {
    stage = <iframe src={file.url} title={file.name} className={styles.frame} />
  } else if (viewer === 'video') {
    stage = <video src={file.url} controls autoPlay playsInline className={styles.video} />
  } else if (viewer === 'audio') {
    stage = (
      <div className={styles.audioCard} style={{ ['--kind' as string]: KIND_COLOR[kind] }}>
        <span className={styles.audioIcon}><Icon size={40} strokeWidth={1.5} /></span>
        <div className={styles.audioName}>{file.name}</div>
        <div className={styles.audioMeta}>{formatBytes(file.sizeBytes, locale)}</div>
        <audio src={file.url} controls autoPlay className={styles.audio} />
      </div>
    )
  } else if (parsedViewer && parsed.isLoading) {
    stage = <div className={styles.loading}><span className={styles.spinner} />{t('previewLoading')}</div>
  } else if (parsedViewer && parsed.data && !renderFailed) {
    const d = parsed.data
    stage = d.kind === 'docx' ? <DocxView buf={d.buf} onError={onRenderError} />
      : d.kind === 'sheets' ? <SheetView sheets={d.sheets} />
        : (
          <div className={styles.textWrap}>
            <pre className={styles.text}>{d.text}</pre>
            {d.truncated && <div className={styles.truncated}>{t('previewTruncated')}</div>}
          </div>
        )
  }

  if (!stage) {
    // No viewer for this type, or parsing failed (old .doc/.xls, a corrupt or oversized file).
    stage = (
      <div className={styles.fallback} style={{ ['--kind' as string]: KIND_COLOR[kind] }}>
        <span className={styles.audioIcon}><Icon size={40} strokeWidth={1.5} /></span>
        <div className={styles.audioName}>{file.name}</div>
        <p className={styles.fallbackText}>{parsed.isError || renderFailed ? t('previewFailed') : t('previewUnavailable')}</p>
        <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={onDownload}><FilesDownloadIcon size={15} /> {t('download')} · {formatBytes(file.sizeBytes, locale)}</button>
      </div>
    )
  }

  return (
    <FilesModal
      size="viewer"
      closeLabel={t('close')}
      onClose={onClose}
      title={
        <span className={styles.titleRow}>
          <span className={styles.kindIcon} style={{ color: KIND_COLOR[kind] }}><Icon size={18} /></span>
          <span className={styles.name}>{file.name}</span>
          <button type="button" className={ui.btn} onClick={onDownload}>
            <FilesDownloadIcon size={15} />
            <span className={styles.downloadLabel}>{t('download')}</span>
          </button>
        </span>
      }
    >
      {review ? (
        <div className={styles.withReview}>
          <div className={styles.stage}>{stage}</div>
          <aside className={styles.reviewPanel}>
            <span className={`${styles.verdict} ${review.status === 'ACCEPTED' ? styles.accepted : styles.revision}`}>
              {review.status === 'ACCEPTED' ? t('reviewAccepted') : t('reviewRevision')}
            </span>
            {review.grade && <div className={styles.grade}><span>{t('reviewGrade')}</span><strong>{review.grade}</strong></div>}
            {review.comment && <p className={styles.reviewComment}>{review.comment}</p>}
            {review.annotations.length > 0 && <p className={styles.reviewMeta}>{t('reviewMarksHint')}</p>}
            <p className={styles.reviewMeta}>{t('reviewedAt', { date: formatDeadline(review.reviewedAt, locale) })}</p>
          </aside>
        </div>
      ) : (
        <div className={styles.stage}>{stage}</div>
      )}
    </FilesModal>
  )
}
