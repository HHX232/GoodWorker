'use client'

import { compressImageForUpload } from '@/shared/helpers/compressImageForUpload'
import { CameraIcon, LightbulbIcon, PencilLineIcon, SparklesIcon, TypeIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { MathMarkup } from './MathView'
import styles from './LectureEditor.module.scss'

type MathField = HTMLElement & { value: string; focus: () => void }
type Mode = 'describe' | 'edit' | 'photo' | 'explain'

interface Props {
  lectureId: string
  canUseAi: boolean
  initial: string
  context: string
  startWithAi?: boolean
  onApply: (latex: string) => void
  onClose: () => void
}

/**
 * Formula editor: mathlive's <math-field> on top (same engine as the
 * whiteboard's formula keyboard), the ✦ AI panel below — describe in words,
 * change by instruction, read off a photo, or explain. The AI answer is a
 * preview first; "Взять" puts it into the field, nothing is applied blindly.
 */
export function FormulaDialog({ lectureId, canUseAi, initial, context, startWithAi, onApply, onClose }: Props) {
  const t = useTranslations('lecture')
  const holder = useRef<HTMLDivElement>(null)
  const field = useRef<MathField | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [current, setCurrent] = useState(initial)
  const [aiOpen, setAiOpen] = useState(!!startWithAi)
  const [mode, setMode] = useState<Mode>(initial.trim() ? 'edit' : 'describe')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ latex: string; explanation: string } | null>(null)

  useEffect(() => {
    let el: MathField | null = null
    let cancelled = false
    import('mathlive').then(() => {
      if (cancelled || !holder.current) return
      el = document.createElement('math-field') as MathField
      el.value = initial
      el.setAttribute('style', 'width:100%;font-size:28px;border:none;background:transparent;outline:none;')
      el.addEventListener('input', () => setCurrent(el?.value ?? ''))
      holder.current.appendChild(el)
      field.current = el
      if (!startWithAi) el.focus()
      setReady(true)
    })
    return () => {
      cancelled = true
      ;(window as unknown as { mathVirtualKeyboard?: { hide: () => void } }).mathVirtualKeyboard?.hide()
      el?.remove()
    }
  }, [initial, startWithAi])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (m: Mode, photo?: File) => {
    if (!canUseAi) { toast.error(t('vipOnly')); return }
    const latex = field.current?.value ?? current
    if ((m === 'describe' || m === 'edit') && !instruction.trim()) { toast.message(t('formulaAiNeedText')); return }
    if ((m === 'edit' || m === 'explain') && !latex.trim()) { toast.message(t('formulaAiNeedFormula')); return }
    setBusy(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('mode', m)
      form.append('latex', latex)
      form.append('instruction', instruction)
      form.append('context', context)
      if (photo) form.append('photo', photo.size > 2.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(photo.type) ? await compressImageForUpload(photo, 2200, 2200, 0.85) : photo)
      const res = await fetch(`/api/lecture/${lectureId}/formula`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'AI_FAILED')
      setResult({ latex: data.latex, explanation: data.explanation ?? '' })
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'VIP_REQUIRED' ? t('vipOnly') : t('aiFailed'))
    } finally {
      setBusy(false)
    }
  }

  const take = () => {
    if (!result) return
    if (field.current) field.current.value = result.latex
    setCurrent(result.latex)
    setResult(null)
    setInstruction('')
  }

  const modes: { id: Mode; icon: React.ReactNode; label: string }[] = [
    { id: 'describe', icon: <TypeIcon size={14} />, label: t('formulaModeDescribe') },
    { id: 'edit', icon: <PencilLineIcon size={14} />, label: t('formulaModeEdit') },
    { id: 'photo', icon: <CameraIcon size={14} />, label: t('formulaModePhoto') },
    { id: 'explain', icon: <LightbulbIcon size={14} />, label: t('formulaModeExplain') },
  ]

  return createPortal(
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${styles.dialog} ${styles.formulaDialog}`} role="dialog" aria-label={t('formulaTitle')}>
        <div className={styles.dialogHead}>
          <div className={styles.dialogTitle}>{t('formulaTitle')}</div>
          <button type="button" className={`${styles.aiChip} ${aiOpen ? styles.aiChipOn : ''}`} onClick={() => setAiOpen(v => !v)}>
            <SparklesIcon size={14} /> {t('formulaAi')}
          </button>
        </div>

        <div className={styles.formulaStage}>
          <div ref={holder} className={styles.mathHolder} />
          <div className={styles.latexLine}><code>{current || '—'}</code></div>
        </div>

        {aiOpen && (
          <div className={styles.aiPanel}>
            <div className={styles.modeRow} role="tablist">
              {modes.map(m => (
                <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={`${styles.modeTab} ${mode === m.id ? styles.modeTabOn : ''}`} onClick={() => { setMode(m.id); setResult(null) }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            {mode !== 'explain' && (
              <input
                className={styles.aiInput}
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && mode !== 'photo') run(mode) }}
                placeholder={mode === 'describe' ? t('formulaDescribePh') : mode === 'edit' ? t('formulaEditPh') : t('formulaPhotoPh')}
              />
            )}
            <div className={styles.aiRow}>
              {mode === 'photo'
                ? <button type="button" className={`${styles.btn} ${styles.aiBtn}`} disabled={busy} onClick={() => photoInput.current?.click()}><CameraIcon size={15} /> {busy ? t('aiThinking') : t('formulaTakePhoto')}</button>
                : <button type="button" className={`${styles.btn} ${styles.aiBtn}`} disabled={busy} onClick={() => run(mode)}><SparklesIcon size={15} /> {busy ? t('aiThinking') : t('formulaRun')}</button>}
            </div>
            {result && (
              <div className={styles.aiResult}>
                {mode !== 'explain' && <div className={styles.aiResultMath}><MathMarkup latex={result.latex} inline={false} /></div>}
                {result.explanation && <p className={styles.aiExplain}>{result.explanation}</p>}
                {mode !== 'explain' && (
                  <div className={styles.dialogActions}>
                    <span className={styles.spacer} />
                    <button type="button" className={styles.btn} onClick={() => setResult(null)}>{t('reject')}</button>
                    <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={take}>{t('formulaTake')}</button>
                  </div>
                )}
              </div>
            )}
            <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) run('photo', f); e.target.value = '' }} />
          </div>
        )}

        <div className={styles.dialogActions}>
          <span className={styles.spacer} />
          <button type="button" className={styles.btn} onClick={onClose}>{t('cancel')}</button>
          <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!ready || !current.trim()} onClick={() => { onApply((field.current?.value ?? current).trim()); onClose() }}>
            {t('apply')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
