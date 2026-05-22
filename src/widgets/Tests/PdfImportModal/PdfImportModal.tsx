'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import styles from './PdfImportModal.module.scss'

// ─── Types ────────────────────────────────────────────────

interface GeneratedBlock {
  id: string
  type: 'CHOOSE_OPTION' | 'FREE_ANSWER' | 'MATCH_PAIRS' | 'INFO_TEXT'
  payload: unknown
}

type Step = 'upload' | 'processing' | 'preview' | 'error'

interface ErrorState {
  message: string
  isPageLimit?: boolean
  isVip?: boolean
}

// ─── Block type config ────────────────────────────────────

const TYPE_STYLE = {
  CHOOSE_OPTION: { color: '#111118', bg: '#f0f0f0' },
  FREE_ANSWER:   { color: '#111118', bg: '#f0f0f0' },
  MATCH_PAIRS:   { color: '#111118', bg: '#f0f0f0' },
  INFO_TEXT:     { color: '#111118', bg: '#f0f0f0' },
} as const

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extractTextFromTiptap(content: unknown): string {
  const c = content as { content?: { content?: { text?: string }[] }[] } | null
  if (!c?.content) return ''
  return c.content
    .flatMap((p) => p.content ?? [])
    .map((n) => (n as { text?: string }).text ?? '')
    .join(' ')
    .slice(0, 120)
}

// ─── Block preview ────────────────────────────────────────

function BlockPreview({ block, selected, onToggle, t }: {
  block: GeneratedBlock
  selected: boolean
  onToggle: () => void
  t: ReturnType<typeof useTranslations<'pdfImport'>>
}) {
  const cfg = TYPE_STYLE[block.type]
  const p = block.payload as any

  const typeLabel = {
    CHOOSE_OPTION: t('typeChoose'),
    FREE_ANSWER:   t('typeFree'),
    MATCH_PAIRS:   t('typeMatch'),
    INFO_TEXT:     t('typeInfo'),
  }[block.type]

  return (
    <div
      className={`${styles.block_row} ${selected ? styles.block_row_selected : ''}`}
      onClick={onToggle}
    >
      <input
        type='checkbox'
        className={styles.block_checkbox}
        checked={selected}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
      />
      <div className={styles.block_content}>
        <span className={styles.block_type_badge} style={{ color: cfg.color, background: cfg.bg }}>
          {typeLabel}
        </span>

        {block.type === 'CHOOSE_OPTION' && (
          <>
            <p className={styles.block_question}>{p.question}</p>
            <div className={styles.block_options}>
              {(p.options ?? []).map((opt: { id: string; text: string }) => (
                <span
                  key={opt.id}
                  className={`${styles.block_option} ${opt.id === p.correctId ? styles.block_option_correct : ''}`}
                >
                  {opt.id === p.correctId ? '✓ ' : '· '}{opt.text}
                </span>
              ))}
            </div>
          </>
        )}

        {block.type === 'FREE_ANSWER' && (
          <>
            <p className={styles.block_question}>{p.question}</p>
            {p.referenceAnswer && (
              <p className={styles.block_ref}>{t('refAnswer', { text: p.referenceAnswer })}</p>
            )}
          </>
        )}

        {block.type === 'MATCH_PAIRS' && (
          <div className={styles.block_pairs}>
            {(p.pairs ?? []).slice(0, 4).map((pair: { id: string; left: string; right: string }) => (
              <span key={pair.id} className={styles.block_pair}>
                <span>{pair.left}</span>
                <span className={styles.block_pair_arrow}>→</span>
                <span>{pair.right}</span>
              </span>
            ))}
            {(p.pairs ?? []).length > 4 && (
              <span className={styles.block_ref}>{t('morePairs', { n: p.pairs.length - 4 })}</span>
            )}
          </div>
        )}

        {block.type === 'INFO_TEXT' && (
          <p className={styles.block_info_preview}>{extractTextFromTiptap(p.content)}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────

interface PdfImportModalProps {
  onClose: () => void
  onImport: (blocks: GeneratedBlock[]) => void
}

export function PdfImportModal({ onClose, onImport }: PdfImportModalProps) {
  const t = useTranslations('pdfImport')

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [processingStep, setProcessingStep] = useState('')
  const [blocks, setBlocks] = useState<GeneratedBlock[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) return
    setFile(f)
    setError(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleProcess = async () => {
    if (!file) return
    setStep('processing')
    setProcessingStep(t('step1'))

    try {
      const form = new FormData()
      form.append('file', file)

      await new Promise((r) => setTimeout(r, 400))
      setProcessingStep(t('step2'))

      const res = await fetch('/api/tests/import-pdf', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'PAGE_LIMIT_EXCEEDED') {
          setError({
            message: `PDF содержит ${data.pageCount} стр. Лимит для ${data.isVip ? 'VIP' : 'бесплатного'} аккаунта — ${data.limit} стр.`,
            isPageLimit: true,
            isVip: data.isVip,
          })
        } else if (data.error === 'AI_QUOTA') {
          setError({ message: t('errQuota', { secs: data.retryAfter ?? 60 }) })
        } else {
          setError({ message: data.error ?? t('errGeneral') })
        }
        setStep('error')
        return
      }

      setProcessingStep(t('step3'))
      await new Promise((r) => setTimeout(r, 300))

      const generatedBlocks: GeneratedBlock[] = data.blocks
      setBlocks(generatedBlocks)
      setPageCount(data.pageCount)
      setSelected(new Set(generatedBlocks.map((b) => b.id)))
      setStep('preview')
    } catch {
      setError({ message: t('errGeneral') })
      setStep('error')
    }
  }

  const toggleBlock = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(selected.size === blocks.length ? new Set() : new Set(blocks.map((b) => b.id)))
  }

  const handleImport = () => {
    onImport(blocks.filter((b) => selected.has(b.id)))
    onClose()
  }

  const reset = () => {
    setStep('upload')
    setFile(null)
    setBlocks([])
    setSelected(new Set())
    setError(null)
    setPageCount(null)
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.header_left}>
            <div className={styles.header_icon}>
              <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
                <polyline points='14 2 14 8 20 8'/>
                <line x1='16' y1='13' x2='8' y2='13'/>
                <line x1='16' y1='17' x2='8' y2='17'/>
                <polyline points='10 9 9 9 8 9'/>
              </svg>
            </div>
            <span className={styles.header_title}>{t('title')}</span>
          </div>
          <button className={styles.close_btn} onClick={onClose}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* ── Step 1: Upload ─────────────────────────────── */}
          {step === 'upload' && (
            <>
              {!file ? (
                <div
                  className={`${styles.drop_zone} ${dragging ? styles.drop_zone_active : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg className={styles.drop_icon} width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
                    <polyline points='14 2 14 8 20 8'/>
                    <line x1='12' y1='18' x2='12' y2='12'/>
                    <polyline points='9 15 12 12 15 15'/>
                  </svg>
                  <p className={styles.drop_label}>
                    {t('dropLabel')} <span>{t('dropLabelLink')}</span>
                  </p>
                  <p className={styles.drop_sub}>{t('dropSub')}</p>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='.pdf'
                    className={styles.file_input}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                </div>
              ) : (
                <div className={styles.file_card}>
                  <div className={styles.file_icon}>
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
                      <polyline points='14 2 14 8 20 8'/>
                    </svg>
                  </div>
                  <div className={styles.file_info}>
                    <p className={styles.file_name}>{file.name}</p>
                    <p className={styles.file_size}>{formatSize(file.size)}</p>
                  </div>
                  <button className={styles.file_remove} onClick={reset}>
                    <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                      <line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/>
                    </svg>
                  </button>
                </div>
              )}

              <div className={styles.vip_notice}>
                <svg className={styles.vip_notice_icon} width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>
                </svg>
                <span dangerouslySetInnerHTML={{ __html: t.raw('vipNotice') }} />
              </div>
            </>
          )}

          {/* ── Step 2: Processing ────────────────────────── */}
          {step === 'processing' && (
            <div className={styles.processing}>
              <div className={styles.spinner} />
              <p className={styles.processing_title}>{t('processing')}</p>
              <p className={styles.processing_step}>{processingStep}</p>
            </div>
          )}

          {/* ── Step 3: Preview ───────────────────────────── */}
          {step === 'preview' && (
            <>
              {pageCount !== null && (
                <div className={styles.success_notice}>
                  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                    <polyline points='20 6 9 17 4 12'/>
                  </svg>
                  <span dangerouslySetInnerHTML={{ __html: t.raw('successNotice').replace('{pages}', String(pageCount)).replace('{count}', String(blocks.length)) }} />
                </div>
              )}

              <div className={styles.preview_header}>
                <span className={styles.preview_count}>{t('selected', { sel: selected.size, total: blocks.length })}</span>
                <button className={styles.select_all_btn} onClick={toggleAll}>
                  {selected.size === blocks.length ? t('deselectAll') : t('selectAll')}
                </button>
              </div>

              <div className={styles.blocks_list}>
                {blocks.map((b) => (
                  <BlockPreview
                    key={b.id}
                    block={b}
                    selected={selected.has(b.id)}
                    onToggle={() => toggleBlock(b.id)}
                    t={t}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Error ──────────────────────────────────────── */}
          {step === 'error' && error && (
            <div className={styles.error_box}>
              <div className={styles.error_icon}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>
                </svg>
              </div>
              <p className={styles.error_title}>{error.isPageLimit ? t('errPageLimit') : t('errGeneral')}</p>
              <p className={styles.error_msg}>{error.message}</p>
              {error.isPageLimit && !error.isVip && (
                <button className={styles.upgrade_btn} onClick={onClose}>{t('upgradeVip')}</button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancel_btn} onClick={step === 'preview' ? reset : onClose}>
            {step === 'preview' ? t('uploadAnother') : t('cancel')}
          </button>

          {step === 'upload' && (
            <button className={styles.action_btn} disabled={!file} onClick={handleProcess}>
              {t('processBtn')}
            </button>
          )}

          {step === 'preview' && (
            <button className={styles.action_btn} disabled={selected.size === 0} onClick={handleImport}>
              {t('importSelected', { count: selected.size })}
            </button>
          )}

          {step === 'error' && (
            <button className={styles.action_btn} onClick={reset}>{t('retry')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
