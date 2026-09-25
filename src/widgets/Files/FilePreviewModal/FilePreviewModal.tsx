'use client'

import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesDownloadIcon } from '../icons'
import { fileKind, formatBytes, KIND_COLOR, KIND_ICON, viewerFor, type ViewerKind } from '../lib'
import ui from '../ui.module.scss'
import styles from './FilePreviewModal.module.scss'
import { colName, parseCsv, parseDocx, parseXlsx, type DocBlock, type DocRun, type Sheet } from './officeParsers'

const MAX_TEXT_CHARS = 400_000

type Parsed =
  | { kind: 'text'; text: string; truncated: boolean }
  | { kind: 'table'; sheets: Sheet[] }
  | { kind: 'doc'; blocks: DocBlock[] }

/** Bytes come through our API (access-checked, no CORS dependency on the bucket). */
async function loadParsed(file: LibraryFile, viewer: ViewerKind): Promise<Parsed> {
  const res = await fetch(`/api/tutor-files/files/${file.id}/content`)
  if (!res.ok) throw new Error(String(res.status))
  const buf = await res.arrayBuffer()
  if (viewer === 'docx') return { kind: 'doc', blocks: await parseDocx(buf) }
  if (viewer === 'xlsx') return { kind: 'table', sheets: await parseXlsx(buf) }
  const text = new TextDecoder().decode(buf)
  if (viewer === 'csv') return { kind: 'table', sheets: [{ name: file.name, rows: parseCsv(text) }] }
  return { kind: 'text', text: text.slice(0, MAX_TEXT_CHARS), truncated: text.length > MAX_TEXT_CHARS }
}

function Runs({ runs }: { runs: DocRun[] }) {
  return (
    <>
      {runs.map((r, i) => {
        let node: ReactNode = r.text
        if (r.bold) node = <strong>{node}</strong>
        if (r.italic) node = <em>{node}</em>
        if (r.underline) node = <u>{node}</u>
        return <span key={i}>{node}</span>
      })}
    </>
  )
}

function DocView({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className={styles.paperWrap}>
      <article className={styles.paper}>
        {blocks.map((b, i) => {
          if (b.type === 'table') {
            return (
              <table key={i} className={styles.docTable}>
                <tbody>{b.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody>
              </table>
            )
          }
          const Tag = b.type === 'li' ? 'li' : b.type
          return b.runs.length === 0 ? <div key={i} className={styles.docGap} /> : <Tag key={i}><Runs runs={b.runs} /></Tag>
        })}
      </article>
    </div>
  )
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
              <tr key={r}><th>{r + 1}</th>{row.map((cell, c) => <td key={c} className={/^-?\d+([.,]\d+)?$/.test(cell) ? styles.num : undefined}>{cell}</td>)}</tr>
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
 * video and audio with native players, and a reading view for txt/md/json,
 * csv, docx and xlsx parsed in the browser. Other types (pptx, archives, …)
 * show a download card. Opening here never posts anything to the chat.
 */
export function FilePreviewModal({ file, onClose, onDownload }: { file: LibraryFile; onClose: () => void; onDownload: () => void }) {
  const t = useTranslations('files')
  const locale = useLocale()
  const viewer = viewerFor(file.mimeType, file.name)
  const kind = fileKind(file.mimeType, file.name)
  const Icon = KIND_ICON[kind]
  const parsedViewer = viewer === 'text' || viewer === 'csv' || viewer === 'docx' || viewer === 'xlsx'

  const parsed = useQuery({
    queryKey: ['tutor-files', 'content', file.id],
    queryFn: () => loadParsed(file, viewer!),
    enabled: parsedViewer,
    retry: false,
    staleTime: 5 * 60_000,
  })

  let stage: ReactNode
  if (viewer === 'image') {
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
  } else if (parsedViewer && parsed.data) {
    const d = parsed.data
    stage = d.kind === 'doc' ? <DocView blocks={d.blocks} />
      : d.kind === 'table' ? <SheetView sheets={d.sheets} />
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
        <p className={styles.fallbackText}>{parsed.isError ? t('previewFailed') : t('previewUnavailable')}</p>
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
      <div className={styles.stage}>{stage}</div>
    </FilesModal>
  )
}
