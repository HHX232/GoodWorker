'use client'

import type { JSONContent } from '@tiptap/core'
import { ArrowRightIcon, RefreshCwIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { SuggestionPreview } from './SuggestionPreview'
import styles from './LectureEditor.module.scss'

export interface AskTarget {
  id: string
  selection: string
  context: string
  /** Viewport rect of the selection when the panel opened. */
  rect: { top: number; bottom: number; left: number; right: number }
  /** Preset instruction (quick actions in the selection menu) — runs immediately. */
  preset?: string
}

interface Props {
  lectureId: string
  target: AskTarget
  /** insertAfter: keep the selection and put the answer right after it. */
  onApply: (blocks: JSONContent[], insertAfter: boolean) => void
  onCancel: () => void
}

/**
 * "Спросить ИИ": a small side-by-side editor next to the selection —
 * "Было" on the left, "ИИ предлагает" on the right (rendered with the real
 * schema, formulas included). Nothing changes in the notes until "Применить".
 */
export function AskAiPanel({ lectureId, target, onApply, onCancel }: Props) {
  const t = useTranslations('lecture')
  const [instruction, setInstruction] = useState(target.preset ?? '')
  const [busy, setBusy] = useState(false)
  const [blocks, setBlocks] = useState<JSONContent[] | null>(null)
  // Replace the selection (default) or add the answer after it — the AI answers differently for each.
  const [insertAfter, setInsertAfter] = useState(false)
  const lastInstruction = useRef('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ranPreset = useRef(false)

  const chips = [t('askChipFix'), t('askChipShorter'), t('askChipSimpler'), t('askChipFormulas'), t('askChipList')]

  const panelRef = useRef<HTMLDivElement>(null)

  // Wide screens: float beside the selection, measured so the whole panel —
  // buttons included — stays on screen as the suggestion grows. Narrow: bottom sheet.
  useLayoutEffect(() => {
    const el = panelRef.current
    const place = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (vw < 900 || !el) { setPos(null); return }
      const width = Math.min(640, vw - 32)
      const height = el.offsetHeight
      const left = Math.min(Math.max(16, target.rect.left), vw - width - 16)
      const below = target.rect.bottom + 12
      const above = target.rect.top - 12 - height
      const top = below + height <= vh - 16 ? below : above >= 16 ? above : Math.max(16, vh - height - 16)
      setPos(p => (p && p.top === top && p.left === left ? p : { top, left }))
    }
    place()
    const ro = el ? new ResizeObserver(place) : null
    if (el) ro!.observe(el)
    window.addEventListener('resize', place)
    return () => { ro?.disconnect(); window.removeEventListener('resize', place) }
  }, [target.rect])

  const run = async (text: string, after = insertAfter) => {
    const instr = text.trim()
    if (!instr || busy) return
    lastInstruction.current = instr
    setBusy(true)
    try {
      const res = await fetch(`/api/lecture/${lectureId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection: target.selection, context: target.context, instruction: instr, insertAfter: after }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'AI_FAILED')
      setBlocks(data.blocks ?? [])
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'VIP_REQUIRED' ? t('vipOnly') : t('aiFailed'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (target.preset && !ranPreset.current) { ranPreset.current = true; run(target.preset) }
    else inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <div ref={panelRef} className={`${styles.askPanel} ${pos ? '' : styles.askSheet}`} style={pos ? { top: pos.top, left: pos.left } : undefined} role="dialog" aria-label={t('askTitle')}>
      <div className={styles.askHead}>
        <span className={styles.askBadge}><SparklesIcon size={13} /> {t('askTitle')}</span>
        <span className={styles.spacer} />
        <button type="button" className={styles.iconBtn} onClick={onCancel} aria-label={t('cancel')}><XIcon size={16} /></button>
      </div>

      <form className={styles.askForm} onSubmit={e => { e.preventDefault(); run(instruction) }}>
        <input ref={inputRef} className={styles.aiInput} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder={t('askPlaceholder')} maxLength={500} />
        <button type="submit" className={`${styles.btn} ${styles.aiBtn}`} disabled={busy || !instruction.trim()} aria-label={t('askRun')}><ArrowRightIcon size={16} /></button>
      </form>
      <div className={styles.chips}>
        {chips.map(c => <button key={c} type="button" className={styles.chip} disabled={busy} onClick={() => { setInstruction(c); run(c) }}>{c}</button>)}
      </div>

      <div className={styles.diff}>
        <div className={styles.diffCol}>
          <span className={styles.diffLabel}>{t('askBefore')}</span>
          <div className={styles.diffBefore}>{target.selection}</div>
        </div>
        <div className={`${styles.diffCol} ${styles.diffAfterCol}`}>
          <span className={`${styles.diffLabel} ${styles.diffLabelAi}`}><SparklesIcon size={11} /> {t('askAfter')}</span>
          {busy
            ? <div className={styles.diffLoading}><span /><span /><span /></div>
            : blocks
              ? <SuggestionPreview blocks={blocks} className={styles.diffAfter} />
              : <div className={styles.diffEmpty}>{t('askEmpty')}</div>}
        </div>
      </div>

      <label className={styles.askAfterOpt}>
        <input
          type="checkbox"
          checked={insertAfter}
          onChange={e => {
            const next = e.target.checked
            setInsertAfter(next)
            // A replacement and an addition are different answers — ask again for the new mode.
            if (blocks && lastInstruction.current) run(lastInstruction.current, next)
          }}
        />
        {t('askInsertAfter')}
      </label>

      <div className={styles.dialogActions}>
        {blocks && <button type="button" className={styles.btn} disabled={busy} onClick={() => run(instruction)}><RefreshCwIcon size={14} /> {t('askAgain')}</button>}
        <span className={styles.spacer} />
        <button type="button" className={styles.btn} onClick={onCancel}>{t('cancel')}</button>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!blocks?.length || busy} onClick={() => blocks && onApply(blocks, insertAfter)}>{insertAfter ? t('askInsert') : t('askApply')}</button>
      </div>
    </div>,
    document.body,
  )
}
