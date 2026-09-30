// The lecture graph block: a small, validated spec (the AI writes it from
// speech or a board photo, the student edits it in a form). The page draws it
// with recharts (GraphChart.tsx); functions are sampled here, since recharts
// only plots data. Word/PDF get a PNG snapshot of the drawn chart, like the
// board block. Prisma-free: client and server share it.
//
// Two kinds:
//   plot — function graphs on axes: several functions, piecewise pieces
//          (domain per function), shaded areas, marked points, polylines
//          through data, vertical/horizontal lines (asymptotes);
//   bar  — category charts: bars, lines, or both combined.

import { compileExpr } from './mathExpr'

export const GRAPH_COLORS = {
  blue: '#2563eb', red: '#dc2626', green: '#16a34a', orange: '#ea580c', purple: '#7c3aed',
  teal: '#0d9488', pink: '#db2777', gray: '#6b7280', black: '#111827',
} as const
export type GraphColor = keyof typeof GRAPH_COLORS
const COLOR_CYCLE: GraphColor[] = ['blue', 'red', 'green', 'orange', 'purple', 'teal', 'pink', 'gray']

export type PlotSeriesKind = 'fn' | 'area' | 'points' | 'line' | 'vline' | 'hline'

export interface GraphPoint { x: number; y: number; label?: string }

export interface PlotSeries {
  kind: PlotSeriesKind
  /** fn/area: expression in x ("x^2 - 3", "sin x"). */
  expr?: string
  /** fn/area: domain — a piece of a piecewise function, or the shaded interval. */
  from?: number
  to?: number
  /** points/line: marked points, or the data a polyline goes through. */
  points?: GraphPoint[]
  /** vline: x = value; hline: y = value. */
  value?: number
  label?: string
  color?: GraphColor
  dashed?: boolean
}

export interface PlotSpec {
  type: 'plot'
  title?: string
  x: [number, number]
  /** Omitted → fitted to the data. */
  y?: [number, number]
  xLabel?: string
  yLabel?: string
  series: PlotSeries[]
}

export interface BarSeries { label?: string; values: number[]; kind: 'bar' | 'line'; color?: GraphColor }

export interface BarSpec {
  type: 'bar'
  title?: string
  categories: string[]
  yLabel?: string
  series: BarSeries[]
}

export type GraphSpec = PlotSpec | BarSpec

// ── Validation ──────────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const color = (v: unknown): GraphColor | undefined => (typeof v === 'string' && v in GRAPH_COLORS ? (v as GraphColor) : undefined)
const range = (v: unknown): [number, number] | null => {
  if (!Array.isArray(v) || v.length !== 2) return null
  const a = num(v[0])
  const b = num(v[1])
  return a !== null && b !== null && a < b && b - a < 1e7 ? [a, b] : null
}
const opt = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T

function points(v: unknown): GraphPoint[] {
  return (Array.isArray(v) ? v : [])
    .map((p): GraphPoint | null => {
      const r = Array.isArray(p) ? { x: p[0], y: p[1] } : (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
      const x = num((r as Record<string, unknown>).x)
      const y = num((r as Record<string, unknown>).y)
      return x === null || y === null ? null : opt({ x, y, label: str((r as Record<string, unknown>).label, 16) || undefined })
    })
    .filter((p): p is GraphPoint => !!p)
    .slice(0, 200)
}

function exprOk(e: string): boolean {
  try { compileExpr(e); return true } catch { return false }
}

/** Validates an AI/editor spec; null when nothing drawable is in it. */
export function parseGraphSpec(raw: unknown): GraphSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const title = str(o.title, 80) || undefined

  if (o.type === 'bar') {
    const categories = (Array.isArray(o.categories) ? o.categories : []).map(c => str(String(c ?? ''), 24)).slice(0, 24)
    if (!categories.length) return null
    const series = (Array.isArray(o.series) ? o.series : [])
      .map((x): BarSeries | null => {
        const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
        const values = (Array.isArray(r.values) ? r.values : []).slice(0, categories.length).map(v => num(v) ?? 0)
        if (!values.length) return null
        return opt({ label: str(r.label, 40) || undefined, values, kind: r.kind === 'line' ? 'line' as const : 'bar' as const, color: color(r.color) })
      })
      .filter((s): s is BarSeries => !!s)
      .slice(0, 6)
    if (!series.length) return null
    return opt({ type: 'bar' as const, title, categories, yLabel: str(o.yLabel, 30) || undefined, series })
  }

  const series = (Array.isArray(o.series) ? o.series : [])
    .map((x): PlotSeries | null => {
      const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
      const kind = (['fn', 'area', 'points', 'line', 'vline', 'hline'] as const).find(k => k === r.kind) ?? (r.expr ? 'fn' : null)
      if (!kind) return null
      const base = { kind, label: str(r.label, 40) || undefined, color: color(r.color), dashed: r.dashed === true ? true : undefined }
      if (kind === 'fn' || kind === 'area') {
        const expr = str(r.expr, 120)
        if (!expr || !exprOk(expr)) return null
        return opt({ ...base, expr, from: num(r.from) ?? undefined, to: num(r.to) ?? undefined })
      }
      if (kind === 'points' || kind === 'line') {
        const pts = points(r.points)
        return pts.length ? opt({ ...base, points: kind === 'line' ? [...pts].sort((a, b) => a.x - b.x) : pts }) : null
      }
      const value = num(r.value)
      return value === null ? null : opt({ ...base, value })
    })
    .filter((s): s is PlotSeries => !!s)
    .slice(0, 10)
  if (!series.length) return null
  return opt({
    type: 'plot' as const, title,
    x: range(o.x) ?? [-10, 10],
    y: range(o.y) ?? undefined,
    xLabel: str(o.xLabel, 20) || undefined,
    yLabel: str(o.yLabel, 20) || undefined,
    series,
  })
}

/** Human line for DeepSeek context / outlines: "[график: y = x^2; y = 2x+1]". */
export function graphSummary(spec: GraphSpec | null): string {
  if (!spec) return '[график]'
  if (spec.type === 'bar') return `[диаграмма${spec.title ? `: ${spec.title}` : ''}; ${spec.categories.slice(0, 6).join(', ')}]`
  const parts = spec.series.slice(0, 5).map(s =>
    s.kind === 'fn' || s.kind === 'area' ? `y = ${s.expr}${s.from !== undefined || s.to !== undefined ? ` на [${s.from ?? '−∞'}; ${s.to ?? '+∞'}]` : ''}`
      : s.kind === 'vline' ? `x = ${s.value}` : s.kind === 'hline' ? `y = ${s.value}` : `${s.points?.length ?? 0} точек`)
  return `[график${spec.title ? ` «${spec.title}»` : ''}: ${parts.join('; ')}]`
}

// ── Data for the chart (drawn with recharts on the page) ─────

export const seriesColor = (c: GraphColor | undefined, i: number) => GRAPH_COLORS[c ?? COLOR_CYCLE[i % COLOR_CYCLE.length]]

export interface PlotData {
  /** One row per sampled x; column `s{i}` = function/area series i (null = gap or outside its domain). */
  rows: Record<string, number | null>[]
  yDomain: [number, number]
  /** Closed ends of piecewise pieces — drawn as dots. */
  ends: { x: number; y: number; series: number }[]
  /** Round-number ticks (1, 2, 5 × 10ⁿ). */
  xTicks: number[]
  yTicks: number[]
}

const SAMPLES = 600

/** Samples every function once; the y-range is fitted to what's visible (percentiles, so asymptotes don't flatten the rest). */
export function samplePlot(spec: PlotSpec): PlotData {
  const [x0, x1] = spec.x
  const fns = spec.series.map(s => {
    if (s.kind !== 'fn' && s.kind !== 'area') return null
    try { return compileExpr(s.expr ?? '') } catch { return null }
  })
  const xs = new Set<number>()
  for (let i = 0; i <= SAMPLES; i++) xs.add(x0 + ((x1 - x0) * i) / SAMPLES)
  spec.series.forEach(s => { for (const e of [s.from, s.to]) if (e !== undefined && e > x0 && e < x1) xs.add(e) })
  const sorted = [...xs].sort((a, b) => a - b)

  const raw = sorted.map(x => {
    const row: Record<string, number | null> = { x }
    spec.series.forEach((s, i) => {
      const fn = fns[i]
      if (!fn) return
      const inside = x >= (s.from ?? -Infinity) - 1e-12 && x <= (s.to ?? Infinity) + 1e-12
      const y = inside ? fn(x) : NaN
      row[`s${i}`] = Number.isFinite(y) ? y : null
    })
    return row
  })

  let yDomain: [number, number]
  if (spec.y) yDomain = spec.y
  else {
    const ys: number[] = []
    raw.forEach(r => spec.series.forEach((_, i) => { const v = r[`s${i}`]; if (typeof v === 'number') ys.push(v) }))
    spec.series.forEach(s => {
      s.points?.forEach(p => ys.push(p.y))
      if (s.kind === 'hline' && s.value !== undefined) ys.push(s.value)
    })
    let y0 = -10
    let y1 = 10
    if (ys.length) {
      ys.sort((a, b) => a - b)
      const q = (p: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(p * (ys.length - 1))))]
      y0 = q(0.02); y1 = q(0.98)
      if (y0 > 0 && y0 < (y1 - y0) * 0.6) y0 = 0
      if (y1 < 0 && -y1 < (y1 - y0) * 0.6) y1 = 0
      if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1 }
      const pad = (y1 - y0) * 0.1
      y0 -= pad; y1 += pad
    }
    const st = niceStep(y1 - y0)
    yDomain = [Math.floor(y0 / st) * st, Math.ceil(y1 / st) * st]
  }

  // Break lines at asymptotes (a jump across the view) and clamp far-off values.
  const [y0, y1] = yDomain
  const span = y1 - y0
  const mid = (y0 + y1) / 2
  spec.series.forEach((_, i) => {
    const key = `s${i}`
    let prev: number | null = null
    for (const r of raw) {
      const v = r[key]
      if (v === undefined) break
      if (v !== null && prev !== null && Math.abs(v - prev) > span * 1.5 && Math.sign(v - mid) !== Math.sign(prev - mid)) r[key] = null
      else if (v !== null) r[key] = Math.max(y0 - span * 3, Math.min(y1 + span * 3, v))
      prev = v
    }
  })

  const ends: PlotData['ends'] = []
  spec.series.forEach((s, i) => {
    if (s.kind !== 'fn' || !fns[i]) return
    for (const e of [s.from, s.to]) {
      if (e === undefined || e < x0 || e > x1) continue
      const y = fns[i]!(e)
      if (Number.isFinite(y) && y >= y0 && y <= y1) ends.push({ x: e, y, series: i })
    }
  })
  return { rows: raw, yDomain, ends, xTicks: ticks(x0, x1), yTicks: ticks(yDomain[0], yDomain[1]) }
}

function ticks(a: number, b: number): number[] {
  const st = niceStep(b - a)
  const out: number[] = []
  for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-9; v += st) out.push(Math.round(v / st) * st)
  return out
}

function niceStep(span: number): number {
  const raw = span / 8
  const pow = 10 ** Math.floor(Math.log10(raw))
  const m = raw / pow
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * pow
}

/** Rows for a bar/line category chart: { name, b0, b1… }. */
export function barRows(spec: BarSpec): Record<string, string | number>[] {
  return spec.categories.map((name, ci) => {
    const row: Record<string, string | number> = { name }
    spec.series.forEach((s, i) => { row[`b${i}`] = s.values[ci] ?? 0 })
    return row
  })
}

/** A fresh plot for the "График" button. */
export function defaultGraphSpec(): PlotSpec {
  return { type: 'plot', x: [-5, 5], series: [{ kind: 'fn', expr: 'x^2', color: 'blue' }] }
}
