'use client'

import type { Editor, JSONContent } from '@tiptap/core'
import { AlertTriangleIcon, BoxIcon, CheckIcon, CopyCheckIcon, CornerDownRightIcon, ImageIcon, LineChartIcon, Loader2Icon, PlusIcon, RotateCcwIcon, SigmaIcon, SparklesIcon, TypeIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { blockAnchors, photoNode, preparePhoto, uploadPhoto, type BlockAnchor, type PreparedPhoto } from './photoTools'
import { SuggestionPreview } from './SuggestionPreview'
import styles from './LectureEditor.module.scss'

type FragmentKind = 'text' | 'formula' | 'figure' | 'graph'
const KINDS: FragmentKind[] = ['text', 'formula', 'figure', 'graph']
const KIND_ICON = { text: TypeIcon, formula: SigmaIcon, figure: BoxIcon, graph: LineChartIcon } as const

interface MergeItem {
  kind: FragmentKind
  action: 'duplicate' | 'continuation' | 'new'
  block: number | null
  reason: string
  blocks: JSONContent[]
}

type Stage = 'preparing' | 'photos' | 'thinking' | 'review' | 'error'

/** One board photo: prepared (cropped + compressed) or failed with an error code (photoErr_*). */
interface Shot {
  file: File
  status: 'preparing' | 'ready' | 'error'
  error?: string
  prepared?: PreparedPhoto
  /** LecturePhoto id once attached — a retried "apply" doesn't upload it twice. */
  photoId?: string
}

// Same cap as the server (photoInput.ts) — a bigger one is named here, before any upload.
const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const errCode = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

/**
 * Left-rail "Обработать фото доски": DeepSeek vision compares the photos with
 * the notes and sorts every fragment — already there (skipped by default),
 * a continuation of block N (inserted right after it), or new (appended).
 * The student reviews the plan and applies it. Each photo has its own status:
 * one that won't open, is too big or fails to upload is named, with «Повторить».
 */
export function PhotoMergeDialog({ lectureId, editor, files, onClose }: { lectureId: string; editor: Editor; files: File[]; onClose: () => void }) {
  const t = useTranslations('lecture')
  const [stage, setStage] = useState<Stage>('preparing')
  const [items, setItems] = useState<MergeItem[]>([])
  const [picked, setPicked] = useState<boolean[]>([])
  // Off by default: the notes get what's on the board, not the snapshots themselves.
  const [attachPhoto, setAttachPhoto] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shots, setShots] = useState<Shot[]>(() => files.map(file => ({ file, status: 'preparing' })))
  const [thumbs, setThumbs] = useState<string[]>([])
  const started = useRef(false)
  const shotsRef = useRef(shots)
  const anchors = useRef<BlockAnchor[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const alive = useRef(true)

  const patch = (idx: number, p: Partial<Shot>) => {
    shotsRef.current = shotsRef.current.map((s, i) => (i === idx ? { ...s, ...p } : s))
    if (alive.current) setShots(shotsRef.current)
  }

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // Thumbnails: made and revoked by the same effect (dev StrictMode mounts twice).
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setThumbs(urls)
    return () => { for (const u of urls) URL.revokeObjectURL(u) }
  }, [files])

  const prepareOne = async (idx: number) => {
    patch(idx, { status: 'preparing', error: undefined })
    try {
      const p = await preparePhoto(shotsRef.current[idx].file, true)
      if (p.file.size > MAX_PHOTO_BYTES) throw new Error('PHOTO_TOO_LARGE')
      patch(idx, { status: 'ready', prepared: p })
    } catch (e) {
      // A file the browser can't decode (HEIC on desktop, a broken download) throws while measuring.
      patch(idx, { status: 'error', error: errCode(e, 'UNREADABLE') === 'PHOTO_TOO_LARGE' ? 'PHOTO_TOO_LARGE' : 'UNREADABLE' })
    }
  }

  /** Photos that are ready go to DeepSeek together (the ones that failed are left out). */
  const analyse = async () => {
    const ready = shotsRef.current.map((s, i) => ({ s, i })).filter(x => x.s.status === 'ready')
    if (!ready.length) { setStage('photos'); return }
    setError(null)
    setStage('thinking')
    try {
      anchors.current = blockAnchors(editor.state.doc)
      const form = new FormData()
      for (const { s } of ready) form.append('photo', s.prepared!.file)
      form.append('outline', JSON.stringify(anchors.current.map(a => a.text)))
      const res = await fetch(`/api/lecture/${lectureId}/photo-merge`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!alive.current) return
      if (!res.ok) {
        // The server names the photo it rejected — mark that one, keep the rest.
        if (Number.isInteger(data.index) && ready[data.index]) {
          patch(ready[data.index].i, { status: 'error', error: data.error ?? 'UNSUPPORTED_PHOTO' })
          setStage('photos')
          return
        }
        throw new Error(data.error ?? 'AI_FAILED')
      }
      const list = (data.items ?? []) as MergeItem[]
      setLabels(anchors.current.map(a => a.text.replace(/\$+/g, '').slice(0, 60)))
      setItems(list)
      setPicked(list.map(i => i.action !== 'duplicate'))
      setStage('review')
    } catch (e) {
      if (!alive.current) return
      const code = errCode(e, 'AI_FAILED')
      if (code === 'VIP_REQUIRED') { toast.error(t('vipOnly')); onClose(); return }
      setError(code)
      setStage('error')
    }
  }

  // Prepare every photo, then — if they all opened — analyse right away; otherwise show which failed.
  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      await Promise.all(shotsRef.current.map((_, i) => prepareOne(i)))
      if (!alive.current) return
      if (shotsRef.current.every(s => s.status === 'ready')) analyse()
      else setStage('photos')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retryPhoto = async (idx: number) => {
    await prepareOne(idx)
    if (stage === 'photos' && shotsRef.current.every(s => s.status === 'ready')) analyse()
  }

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
      const photoNodes: JSONContent[] = []
      if (attachPhoto) {
        let failed = false
        for (const [idx, shot] of shotsRef.current.entries()) {
          if (shot.status !== 'ready' || !shot.prepared) continue
          if (!shot.photoId) {
            try { patch(idx, { photoId: await uploadPhoto(lectureId, shot.prepared) }) } catch (e) { patch(idx, { error: errCode(e, 'UPLOAD_FAILED') }); failed = true; continue }
          }
          const done = shotsRef.current[idx]
          photoNodes.push(photoNode(done.photoId!, done.prepared!))
        }
        // Nothing inserted yet — the student retries the failed upload (or unticks «Вставить фото»).
        if (failed) { setApplying(false); return }
      }
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
      if (photoNodes.length) {
        // The photos go before the first thing taken from them.
        if (inserts.length) inserts.sort((a, b) => a.at - b.at)[0].content.unshift(...photoNodes)
        else appended.unshift(...photoNodes)
      }
      const chain = editor.chain()
      for (const ins of inserts.sort((a, b) => b.at - a.at)) chain.insertContentAt(ins.at, ins.content)
      if (appended.length) chain.insertContentAt(editor.state.doc.content.size, appended)
      chain.run()
      toast.success(t('mergeApplied', { n: chosen.length }))
      onClose()
    } catch {
      toast.error(t('photoFailed'))
      setApplying(false)
    }
  }

  /** Error line for one photo (photoErr_*), with the quota wording the rest of the page uses. */
  const photoError = (code: string) => (code === 'QUOTA_EXCEEDED' ? t('quotaExceeded') : t.has(`photoErr_${code}`) ? t(`photoErr_${code}`) : t('photoErr_UPLOAD_FAILED'))
  const readyCount = shots.filter(s => s.status === 'ready').length
  const uploadFailed = shots.some(s => s.status === 'ready' && s.error)

  const icon = (a: MergeItem['action']) => a === 'duplicate' ? <CopyCheckIcon size={13} /> : a === 'continuation' ? <CornerDownRightIcon size={13} /> : <PlusIcon size={13} />

  return createPortal(
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !applying) onClose() }}>
      <div className={`${styles.dialog} ${styles.mergeDialog}`} role="dialog" aria-label={t('processPhoto')}>
        <div className={styles.dialogHead}>
          <span className={styles.askBadge}><SparklesIcon size={13} /> {t('processPhoto')}</span>
        </div>

        {shots.length > 0 && (
          <ul className={styles.shotList}>
            {shots.map((shot, idx) => {
              const err = shot.status === 'error' ? shot.error : shot.error && attachPhoto ? shot.error : undefined
              return (
                <li key={idx} className={`${styles.shot} ${err ? styles.shotBad : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbs[idx]} alt="" className={styles.shotThumb} onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                  <div className={styles.shotInfo}>
                    <strong>{t('photoN', { n: idx + 1 })}</strong>
                    <span className={styles.shotName}>{shot.file.name}</span>
                    {err
                      ? <span className={styles.shotErr}><AlertTriangleIcon size={13} /> {photoError(err)}</span>
                      : shot.status === 'preparing'
                        ? <span className={styles.shotOk}><Loader2Icon size={13} className="lecture-spin" /> {t('cropping')}</span>
                        : <span className={styles.shotOk}><CheckIcon size={13} /> {t('photoReady')}</span>}
                  </div>
                  {err && (
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={shot.status === 'preparing' || applying}
                      onClick={() => (shot.status === 'error' ? retryPhoto(idx) : (patch(idx, { error: undefined }), apply()))}
                    >
                      <RotateCcwIcon size={14} /> {t('photoRetry')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {(stage === 'preparing' || stage === 'thinking') && (
          <div className={styles.mergeProgress}>
            <Loader2Icon size={22} className="lecture-spin" />
            <div>
              <div className={styles.mergeStep}>{stage === 'preparing' ? t('cropping') : t('mergeThinking')}</div>
              <div className={styles.mergeHint}>{t('mergeHint')}</div>
            </div>
          </div>
        )}

        {stage === 'photos' && (
          <p className={styles.mergeHint}>{readyCount ? t('photosSomeFailed', { ok: readyCount, total: shots.length }) : t('photosAllFailed')}</p>
        )}
        {stage === 'error' && (
          <div className={styles.mergeError}>
            <AlertTriangleIcon size={16} />
            <span>{photoError(error ?? 'AI_FAILED')}</span>
            <button type="button" className={styles.btn} onClick={analyse}><RotateCcwIcon size={14} /> {t('photoRetry')}</button>
          </div>
        )}
        {stage === 'review' && uploadFailed && attachPhoto && <p className={styles.mergeHint}>{t('photosUploadFailed')}</p>}

        {stage === 'review' && items.length > 0 && (
          // What the photo held, by kind — text, formulas, figures, graphs are all checked every time.
          <div className={styles.mergeFound}>
            <span>{t('mergeFound')}</span>
            {KINDS.map(k => {
              const n = items.filter(i => (i.kind ?? 'text') === k).length
              const Icon = KIND_ICON[k]
              return <span key={k} className={`${styles.kindChip} ${n ? '' : styles.kindChipNone}`}><Icon size={13} /> {t(`fragment_${k}`)} · {n}</span>
            })}
          </div>
        )}

        {stage === 'review' && (
          items.length === 0 ? <p className={styles.mergeHint}>{t('photoNothing')}</p> : (
            <ul className={styles.mergeList}>
              {items.map((item, idx) => (
                <li key={idx} className={`${styles.mergeItem} ${picked[idx] ? styles.mergeItemOn : ''}`}>
                  <label className={styles.mergeHead}>
                    <input type="checkbox" checked={!!picked[idx]} onChange={e => setPicked(p => p.map((v, j) => (j === idx ? e.target.checked : v)))} />
                    <span className={`${styles.mergeTag} ${styles[`mergeTag_${item.action}`]}`}>{icon(item.action)} {t(`mergeKind_${item.action}`)}</span>
                    <span className={styles.kindChip}>{(() => { const Icon = KIND_ICON[item.kind ?? 'text']; return <Icon size={13} /> })()} {t(`fragment_${item.kind ?? 'text'}`)}</span>
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
            <label className={styles.option}><input type="checkbox" checked={attachPhoto} onChange={e => setAttachPhoto(e.target.checked)} /><ImageIcon size={15} /> {t('optInsertImage')}{readyCount > 1 ? ` (${readyCount})` : ''}</label>
          )}
          <span className={styles.spacer} />
          <button type="button" className={styles.btn} onClick={onClose} disabled={applying}>{t('cancel')}</button>
          {stage === 'photos' && readyCount > 0 && (
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={analyse}><SparklesIcon size={15} /> {t('photosContinueWithout')}</button>
          )}
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
