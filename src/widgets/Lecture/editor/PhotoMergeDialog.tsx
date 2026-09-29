'use client'

import type { Editor, JSONContent } from '@tiptap/core'
import { CheckIcon, CopyCheckIcon, CornerDownRightIcon, ImageIcon, Loader2Icon, PlusIcon, SparklesIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { blockAnchors, photoNode, preparePhoto, uploadPhoto, type BlockAnchor, type PreparedPhoto } from './photoTools'
import { SuggestionPreview } from './SuggestionPreview'
import styles from './LectureEditor.module.scss'

interface MergeItem {
  action: 'duplicate' | 'continuation' | 'new'
  block: number | null
  reason: string
  blocks: JSONContent[]
}

type Stage = 'preparing' | 'thinking' | 'review' | 'error'

/**
 * Left-rail "Обработать фото доски": DeepSeek vision compares the photo with
 * the notes and sorts every fragment — already there (skipped by default),
 * a continuation of block N (inserted right after it), or new (appended).
 * The student reviews the plan and applies it.
 */
export function PhotoMergeDialog({ lectureId, editor, file, onClose }: { lectureId: string; editor: Editor; file: File; onClose: () => void }) {
  const t = useTranslations('lecture')
  const [stage, setStage] = useState<Stage>('preparing')
  const [items, setItems] = useState<MergeItem[]>([])
  const [picked, setPicked] = useState<boolean[]>([])
  const [attachPhoto, setAttachPhoto] = useState(true)
  const [applying, setApplying] = useState(false)
  const prepared = useRef<PreparedPhoto | null>(null)
  const anchors = useRef<BlockAnchor[]>([])
  const [labels, setLabels] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await preparePhoto(file, true)
        if (cancelled) return
        prepared.current = p
        anchors.current = blockAnchors(editor.state.doc)
        setStage('thinking')
        const form = new FormData()
        form.append('photo', p.file)
        form.append('outline', JSON.stringify(anchors.current.map(a => a.text)))
        const res = await fetch(`/api/lecture/${lectureId}/photo-merge`, { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'AI_FAILED')
        if (cancelled) return
        const list = (data.items ?? []) as MergeItem[]
        setLabels(anchors.current.map(a => a.text.replace(/\$+/g, '').slice(0, 60)))
        setItems(list)
        setPicked(list.map(i => i.action !== 'duplicate'))
        setStage('review')
      } catch (e) {
        if (cancelled) return
        toast.error(e instanceof Error && e.message === 'VIP_REQUIRED' ? t('vipOnly') : t('photoFailed'))
        setStage('error')
      }
    })()
    return () => { cancelled = true }
  }, [editor, file, lectureId, t])

  const where = (i: MergeItem) => {
    const text = i.block !== null ? labels[i.block] ?? '' : ''
    if (i.action === 'duplicate') return t('mergeDuplicate', { text })
    if (i.action === 'continuation') return t('mergeContinuation', { text })
    return t('mergeNew')
  }

  const apply = async () => {
    setApplying(true)
    try {
      const chosen = items.filter((_, idx) => picked[idx])
      const photoId = attachPhoto && prepared.current ? await uploadPhoto(lectureId, prepared.current) : null
      // Positions come from the doc as it was when the photo was analysed —
      // insert from the bottom up so earlier positions stay valid.
      const size = editor.state.doc.content.size
      const inserts: { at: number; content: JSONContent[] }[] = []
      const appended: JSONContent[] = []
      for (const item of chosen) {
        const anchor = item.block !== null ? anchors.current[item.block] : undefined
        if (item.action === 'continuation' && anchor) inserts.push({ at: Math.min(anchor.end, size), content: item.blocks })
        else if (item.action === 'duplicate' && anchor) inserts.push({ at: Math.min(anchor.end, size), content: item.blocks })
        else appended.push(...item.blocks)
      }
      if (photoId && prepared.current) {
        // The photo goes before the first thing taken from it.
        const photo = photoNode(photoId, prepared.current)
        if (inserts.length) inserts.sort((a, b) => a.at - b.at)[0].content.unshift(photo)
        else appended.unshift(photo)
      }
      const chain = editor.chain()
      for (const ins of inserts.sort((a, b) => b.at - a.at)) chain.insertContentAt(ins.at, ins.content)
      if (appended.length) chain.insertContentAt(editor.state.doc.content.size, appended)
      chain.run()
      toast.success(t('mergeApplied', { n: chosen.length }))
      onClose()
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'QUOTA_EXCEEDED' ? t('quotaExceeded') : t('photoFailed'))
      setApplying(false)
    }
  }

  const icon = (a: MergeItem['action']) => a === 'duplicate' ? <CopyCheckIcon size={13} /> : a === 'continuation' ? <CornerDownRightIcon size={13} /> : <PlusIcon size={13} />

  return createPortal(
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !applying) onClose() }}>
      <div className={`${styles.dialog} ${styles.mergeDialog}`} role="dialog" aria-label={t('processPhoto')}>
        <div className={styles.dialogHead}>
          <span className={styles.askBadge}><SparklesIcon size={13} /> {t('processPhoto')}</span>
        </div>

        {(stage === 'preparing' || stage === 'thinking') && (
          <div className={styles.mergeProgress}>
            <Loader2Icon size={22} className="lecture-spin" />
            <div>
              <div className={styles.mergeStep}>{stage === 'preparing' ? t('cropping') : t('mergeThinking')}</div>
              <div className={styles.mergeHint}>{t('mergeHint')}</div>
            </div>
          </div>
        )}

        {stage === 'error' && <p className={styles.mergeHint}>{t('photoFailed')}</p>}

        {stage === 'review' && (
          items.length === 0 ? <p className={styles.mergeHint}>{t('photoNothing')}</p> : (
            <ul className={styles.mergeList}>
              {items.map((item, idx) => (
                <li key={idx} className={`${styles.mergeItem} ${picked[idx] ? styles.mergeItemOn : ''}`}>
                  <label className={styles.mergeHead}>
                    <input type="checkbox" checked={!!picked[idx]} onChange={e => setPicked(p => p.map((v, j) => (j === idx ? e.target.checked : v)))} />
                    <span className={`${styles.mergeTag} ${styles[`mergeTag_${item.action}`]}`}>{icon(item.action)} {t(`mergeKind_${item.action}`)}</span>
                    <span className={styles.mergeWhere}>{where(item)}</span>
                  </label>
                  {item.reason && <p className={styles.mergeReason}>{item.reason}</p>}
                  <SuggestionPreview blocks={item.blocks} className={styles.diffAfter} />
                </li>
              ))}
            </ul>
          )
        )}

        <div className={styles.dialogActions}>
          {stage === 'review' && (
            <label className={styles.option}><input type="checkbox" checked={attachPhoto} onChange={e => setAttachPhoto(e.target.checked)} /><ImageIcon size={15} /> {t('optInsertImage')}</label>
          )}
          <span className={styles.spacer} />
          <button type="button" className={styles.btn} onClick={onClose} disabled={applying}>{t('cancel')}</button>
          {stage === 'review' && (
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={apply} disabled={applying || (!picked.some(Boolean) && !attachPhoto)}>
              {applying ? <Loader2Icon size={15} className="lecture-spin" /> : <CheckIcon size={15} />} {t('mergeApply')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
