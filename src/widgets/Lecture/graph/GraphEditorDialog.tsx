'use client'

import { compressImageForUpload } from '@/shared/helpers/compressImageForUpload'
import { isValidExpr } from '@/shared/lib/lecture/mathExpr'
import { GRAPH_COLORS, parseGraphSpec, type GraphColor, type GraphSpec, type PlotSeriesKind } from '@/shared/lib/lecture/graphSpec'
import { CameraIcon, LineChartIcon, Loader2Icon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { GraphChart } from './GraphChart'
import styles from '../ui/ToolDialog.module.scss'

// The form keeps what the student typed (strings) — the spec is rebuilt and
// validated on every change, so the preview is always what will be saved.
interface DraftSeries { kind: PlotSeriesKind; expr: string; from: string; to: string; points: string; value: string; label: string; color: GraphColor; dashed: boolean }
interface DraftBar { label: string; values: string; kind: 'bar' | 'line'; color: GraphColor }
interface Draft {
  type: 'plot' | 'bar'
  title: string
  xMin: string; xMax: string
  yAuto: boolean; yMin: string; yMax: string
  xLabel: string; yLabel: string
  series: DraftSeries[]
  categories: string
  bars: DraftBar[]
}

const COLORS = Object.keys(GRAPH_COLORS) as GraphColor[]
const KINDS: PlotSeriesKind[] = ['fn', 'area', 'points', 'line', 'vline', 'hline']
const n = (v: number | undefined) => (v === undefined ? '' : String(v))

function newSeries(i: number, kind: PlotSeriesKind = 'fn'): DraftSeries {
  return { kind, expr: '', from: '', to: '', points: '', value: '', label: '', color: COLORS[i % 6], dashed: false }
}

function toDraft(spec: GraphSpec): Draft {
  const base: Draft = { type: spec.type, title: spec.title ?? '', xMin: '-10', xMax: '10', yAuto: true, yMin: '', yMax: '', xLabel: '', yLabel: '', series: [], categories: '', bars: [] }
  if (spec.type === 'bar') {
    return { ...base, yLabel: spec.yLabel ?? '', categories: spec.categories.join(', '), bars: spec.series.map((s, i) => ({ label: s.label ?? '', values: s.values.join('; '), kind: s.kind, color: s.color ?? COLORS[i % 6] })) }
  }
  return {
    ...base,
    xMin: n(spec.x[0]), xMax: n(spec.x[1]),
    yAuto: !spec.y, yMin: n(spec.y?.[0]), yMax: n(spec.y?.[1]),
    xLabel: spec.xLabel ?? '', yLabel: spec.yLabel ?? '',
    series: spec.series.map((s, i) => ({
      kind: s.kind, expr: s.expr ?? '', from: n(s.from), to: n(s.to), value: n(s.value), label: s.label ?? '',
      points: (s.points ?? []).map(p => `${p.x}; ${p.y}${p.label ? `; ${p.label}` : ''}`).join('\n'),
      color: s.color ?? COLORS[i % 6], dashed: !!s.dashed,
    })),
  }
}

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.trim().replace(',', '.').replace('−', '-')))

function parsePoints(text: string) {
  return text.split('\n').map(line => {
    const parts = line.includes(';') ? line.split(';') : line.trim().split(/\s+/)
    return { x: num(parts[0] ?? ''), y: num(parts[1] ?? ''), label: (parts[2] ?? '').trim() }
  }).filter(p => p.x !== undefined && p.y !== undefined)
}

function fromDraft(d: Draft): GraphSpec | null {
  if (d.type === 'bar') {
    return parseGraphSpec({
      type: 'bar', title: d.title, yLabel: d.yLabel,
      categories: d.categories.split(/[,;\n]/).map(c => c.trim()).filter(Boolean),
      series: d.bars.map(b => ({ label: b.label, kind: b.kind, color: b.color, values: b.values.split(/[;\s]+/).filter(Boolean).map(v => num(v) ?? 0) })),
    })
  }
  return parseGraphSpec({
    type: 'plot', title: d.title, xLabel: d.xLabel, yLabel: d.yLabel,
    x: [num(d.xMin), num(d.xMax)],
    y: d.yAuto ? undefined : [num(d.yMin), num(d.yMax)],
    series: d.series.map(s => ({
      kind: s.kind, label: s.label, color: s.color, dashed: s.dashed || undefined,
      expr: s.expr, from: num(s.from), to: num(s.to), value: num(s.value), points: parsePoints(s.points),
    })),
  })
}

interface Props {
  lectureId: string
  canUseAi: boolean
  initial: GraphSpec
  /** The block was just inserted — the placeholder x² isn't the student's. */
  isNew: boolean
  onApply: (spec: GraphSpec) => void
  onClose: () => void
}

/** The graph block's editor: form on the left, live recharts preview on the right, ✦ AI on top (words, photo, "change it…"). */
export function GraphEditorDialog({ lectureId, canUseAi, initial, isNew, onApply, onClose }: Props) {
  const t = useTranslations('lecture')
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [ask, setAsk] = useState('')
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const spec = useMemo(() => fromDraft(draft), [draft])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }))
  const setSeries = (i: number, patch: Partial<DraftSeries>) => setDraft(d => ({ ...d, series: d.series.map((s, k) => (k === i ? { ...s, ...patch } : s)) }))
  const setBar = (i: number, patch: Partial<DraftBar>) => setDraft(d => ({ ...d, bars: d.bars.map((s, k) => (k === i ? { ...s, ...patch } : s)) }))

  const switchType = (type: 'plot' | 'bar') => setDraft(d => {
    if (d.type === type) return d
    if (type === 'bar' && !d.bars.length) return { ...d, type, categories: 'A, B, C', bars: [{ label: '', values: '3; 5; 4', kind: 'bar', color: 'blue' }] }
    if (type === 'plot' && !d.series.length) return { ...d, type, series: [{ ...newSeries(0), expr: 'x^2' }] }
    return { ...d, type }
  })

  const runAi = async (photo?: File) => {
    if (!canUseAi) { toast.error(t('vipOnly')); return }
    if (!photo && !ask.trim()) { toast.message(t('graphAiNeedText')); return }
    setBusy(true)
    try {
      const form = new FormData()
      // A fresh block still showing the placeholder → build from scratch; otherwise change what's there.
      const untouched = isNew && JSON.stringify(spec) === JSON.stringify(initial)
      form.append('mode', photo ? 'photo' : untouched ? 'describe' : 'edit')
      form.append('instruction', ask)
      if (spec) form.append('spec', JSON.stringify(spec))
      if (photo) form.append('photo', photo.size > 2.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(photo.type) ? await compressImageForUpload(photo, 2200, 2200, 0.85) : photo)
      const res = await fetch(`/api/lecture/${lectureId}/graph`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.spec) throw new Error(data.error ?? 'AI_FAILED')
      setDraft(toDraft(data.spec as GraphSpec))
      setAsk('')
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'VIP_REQUIRED' ? t('vipOnly') : e instanceof Error && e.message === 'NO_GRAPH' ? t('graphAiNothing') : t('aiFailed'))
    } finally {
      setBusy(false)
    }
  }

  const kindHas = (k: PlotSeriesKind) => ({ expr: k === 'fn' || k === 'area', range: k === 'fn' || k === 'area', points: k === 'points' || k === 'line', value: k === 'vline' || k === 'hline' })

  return createPortal(
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog} role="dialog" aria-label={t('graphEditTitle')}>
        <div className={styles.head}>
          <span className={styles.headTitle}><LineChartIcon size={17} /> {t('graphEditTitle')}</span>
          <div className={styles.typeSwitch} role="tablist">
            <button type="button" role="tab" aria-selected={draft.type === 'plot'} className={draft.type === 'plot' ? styles.typeOn : ''} onClick={() => switchType('plot')}>{t('graphTypePlot')}</button>
            <button type="button" role="tab" aria-selected={draft.type === 'bar'} className={draft.type === 'bar' ? styles.typeOn : ''} onClick={() => switchType('bar')}>{t('graphTypeBar')}</button>
          </div>
          <span className={styles.spacer} />
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('cancel')}><XIcon size={18} /></button>
        </div>

        <div className={styles.aiBar}>
          <SparklesIcon size={16} className={styles.aiIcon} />
          <input
            className={styles.aiInput}
            value={ask}
            onChange={e => setAsk(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy) runAi() }}
            placeholder={t('graphAiPh')}
            disabled={busy}
          />
          <button type="button" className={styles.aiBtn} disabled={busy} onClick={() => runAi()}>{busy ? <Loader2Icon size={15} className={styles.spin} /> : <SparklesIcon size={15} />} {t('graphAiRun')}</button>
          <button type="button" className={styles.aiBtnGhost} disabled={busy} onClick={() => photoInput.current?.click()}><CameraIcon size={15} /> {t('graphAiPhoto')}</button>
          <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) runAi(f); e.target.value = '' }} />
        </div>

        <div className={styles.body}>
          <div className={styles.form}>
            <label className={styles.field}><span>{t('graphName')}</span><input value={draft.title} onChange={e => set({ title: e.target.value })} placeholder={t('graphNamePh')} /></label>

            {draft.type === 'plot' ? (
              <>
                <div className={styles.row}>
                  <label className={styles.field}><span>x {t('graphFrom')}</span><input inputMode="decimal" value={draft.xMin} onChange={e => set({ xMin: e.target.value })} /></label>
                  <label className={styles.field}><span>x {t('graphTo')}</span><input inputMode="decimal" value={draft.xMax} onChange={e => set({ xMax: e.target.value })} /></label>
                  <label className={styles.check}><input type="checkbox" checked={draft.yAuto} onChange={e => set({ yAuto: e.target.checked })} /> {t('graphYAuto')}</label>
                </div>
                {!draft.yAuto && (
                  <div className={styles.row}>
                    <label className={styles.field}><span>y {t('graphFrom')}</span><input inputMode="decimal" value={draft.yMin} onChange={e => set({ yMin: e.target.value })} /></label>
                    <label className={styles.field}><span>y {t('graphTo')}</span><input inputMode="decimal" value={draft.yMax} onChange={e => set({ yMax: e.target.value })} /></label>
                  </div>
                )}
                <div className={styles.row}>
                  <label className={styles.field}><span>{t('graphXLabel')}</span><input value={draft.xLabel} onChange={e => set({ xLabel: e.target.value })} placeholder="x" /></label>
                  <label className={styles.field}><span>{t('graphYLabel')}</span><input value={draft.yLabel} onChange={e => set({ yLabel: e.target.value })} placeholder="y" /></label>
                </div>

                <div className={styles.sectionHead}>{t('graphSeries')}</div>
                {draft.series.map((s, i) => {
                  const has = kindHas(s.kind)
                  const bad = has.expr && s.expr.trim() !== '' && !isValidExpr(s.expr)
                  return (
                    <div key={i} className={styles.card} style={{ borderLeftColor: GRAPH_COLORS[s.color] }}>
                      <div className={styles.cardHead}>
                        <select value={s.kind} onChange={e => setSeries(i, { kind: e.target.value as PlotSeriesKind })} aria-label={t('graphKind')}>
                          {KINDS.map(k => <option key={k} value={k}>{t(`graphKind_${k}`)}</option>)}
                        </select>
                        <div className={styles.swatches}>
                          {COLORS.map(c => <button key={c} type="button" aria-label={c} className={`${styles.swatch} ${s.color === c ? styles.swatchOn : ''}`} style={{ background: GRAPH_COLORS[c] }} onClick={() => setSeries(i, { color: c })} />)}
                        </div>
                        <button type="button" className={styles.iconBtn} onClick={() => set({ series: draft.series.filter((_, k) => k !== i) })} aria-label={t('delete')}><Trash2Icon size={15} /></button>
                      </div>
                      {has.expr && (
                        <label className={`${styles.field} ${bad ? styles.fieldBad : ''}`}>
                          <span>y =</span>
                          <input className={styles.mono} value={s.expr} onChange={e => setSeries(i, { expr: e.target.value })} placeholder="x^2 - 2x + 1,  sin x,  1/(x-1),  e^(-x)" spellCheck={false} />
                          {bad && <em>{t('graphBadExpr')}</em>}
                        </label>
                      )}
                      {has.range && (
                        <div className={styles.row}>
                          <label className={styles.field}><span>{s.kind === 'area' ? t('graphAreaFrom') : t('graphPieceFrom')}</span><input inputMode="decimal" value={s.from} onChange={e => setSeries(i, { from: e.target.value })} placeholder="−∞" /></label>
                          <label className={styles.field}><span>{t('graphTo')}</span><input inputMode="decimal" value={s.to} onChange={e => setSeries(i, { to: e.target.value })} placeholder="+∞" /></label>
                        </div>
                      )}
                      {has.points && (
                        <label className={styles.field}><span>{t('graphPoints')}</span><textarea className={styles.mono} rows={4} value={s.points} onChange={e => setSeries(i, { points: e.target.value })} placeholder={'0; 0; O\n1; 2; A\n2; 3'} spellCheck={false} /></label>
                      )}
                      {has.value && (
                        <label className={styles.field}><span>{s.kind === 'vline' ? 'x =' : 'y ='}</span><input inputMode="decimal" value={s.value} onChange={e => setSeries(i, { value: e.target.value })} /></label>
                      )}
                      <div className={styles.row}>
                        <label className={styles.field}><span>{t('graphLabel')}</span><input value={s.label} onChange={e => setSeries(i, { label: e.target.value })} placeholder={has.expr && s.expr ? `y = ${s.expr}` : ''} /></label>
                        {s.kind !== 'points' && <label className={styles.check}><input type="checkbox" checked={s.dashed} onChange={e => setSeries(i, { dashed: e.target.checked })} /> {t('graphDashed')}</label>}
                      </div>
                    </div>
                  )
                })}
                <div className={styles.addRow}>
                  {KINDS.map(k => <button key={k} type="button" className={styles.addBtn} onClick={() => set({ series: [...draft.series, newSeries(draft.series.length, k)] })}><PlusIcon size={13} /> {t(`graphKind_${k}`)}</button>)}
                </div>
              </>
            ) : (
              <>
                <label className={styles.field}><span>{t('graphCategories')}</span><input value={draft.categories} onChange={e => set({ categories: e.target.value })} placeholder="Янв, Фев, Мар" /></label>
                <label className={styles.field}><span>{t('graphYLabel')}</span><input value={draft.yLabel} onChange={e => set({ yLabel: e.target.value })} /></label>
                <div className={styles.sectionHead}>{t('graphSeries')}</div>
                {draft.bars.map((b, i) => (
                  <div key={i} className={styles.card} style={{ borderLeftColor: GRAPH_COLORS[b.color] }}>
                    <div className={styles.cardHead}>
                      <select value={b.kind} onChange={e => setBar(i, { kind: e.target.value as 'bar' | 'line' })} aria-label={t('graphKind')}>
                        <option value="bar">{t('graphBarKind_bar')}</option>
                        <option value="line">{t('graphBarKind_line')}</option>
                      </select>
                      <div className={styles.swatches}>
                        {COLORS.map(c => <button key={c} type="button" aria-label={c} className={`${styles.swatch} ${b.color === c ? styles.swatchOn : ''}`} style={{ background: GRAPH_COLORS[c] }} onClick={() => setBar(i, { color: c })} />)}
                      </div>
                      <button type="button" className={styles.iconBtn} onClick={() => set({ bars: draft.bars.filter((_, k) => k !== i) })} aria-label={t('delete')}><Trash2Icon size={15} /></button>
                    </div>
                    <label className={styles.field}><span>{t('graphValues')}</span><input className={styles.mono} value={b.values} onChange={e => setBar(i, { values: e.target.value })} placeholder="3; 5; 4" /></label>
                    <label className={styles.field}><span>{t('graphLabel')}</span><input value={b.label} onChange={e => setBar(i, { label: e.target.value })} /></label>
                  </div>
                ))}
                <div className={styles.addRow}>
                  <button type="button" className={styles.addBtn} onClick={() => set({ bars: [...draft.bars, { label: '', values: '', kind: 'bar', color: COLORS[draft.bars.length % 6] }] })}><PlusIcon size={13} /> {t('graphBarKind_bar')}</button>
                  <button type="button" className={styles.addBtn} onClick={() => set({ bars: [...draft.bars, { label: '', values: '', kind: 'line', color: COLORS[draft.bars.length % 6] }] })}><PlusIcon size={13} /> {t('graphBarKind_line')}</button>
                </div>
              </>
            )}
          </div>

          <div className={styles.preview}>
            <div className={styles.previewPaper}>
              {spec ? <GraphChart spec={spec} /> : <div className={styles.previewEmpty}>{t('graphEmpty')}</div>}
            </div>
          </div>
        </div>

        <div className={styles.foot}>
          <span className={styles.spacer} />
          <button type="button" className={styles.btn} onClick={onClose}>{t('cancel')}</button>
          <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!spec} onClick={() => { if (spec) { onApply(spec); onClose() } }}>{t('apply')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
