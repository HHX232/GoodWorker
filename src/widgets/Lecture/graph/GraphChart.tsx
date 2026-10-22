'use client'

import { prettyExpr } from '@/shared/lib/lecture/mathExpr'
import { barRows, samplePlot, seriesColor, type BarSpec, type GraphSpec, type PlotSpec } from '@/shared/lib/lecture/graphSpec'
import { useMemo } from 'react'
import {
  Area, Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, XAxis, YAxis,
} from 'recharts'

export const GRAPH_ASPECT = 720 / 440
const AXIS = '#374151'
const GRID = '#e5e7eb'
/** The chart's frame is quiet; the real axes are the dark lines through the origin. */
const FRAME = '#9ca3af'
const TICK = { fontSize: 12, fill: '#4b5563' }
const fmt = (v: number) => {
  const r = Math.round(v * 1000) / 1000
  return String(r).replace('-', '−')
}

/**
 * A lecture graph drawn with recharts (the app's chart library). Light,
 * fixed colours on white — the block reads like a figure on paper, and the
 * snapshot for Word/PDF looks the same in dark theme. Animations are off so
 * the snapshot never catches a half-drawn line.
 */
export function GraphChart({ spec }: { spec: GraphSpec }) {
  return (
    <ResponsiveContainer width="100%" aspect={GRAPH_ASPECT}>
      {spec.type === 'bar' ? <BarGraph spec={spec} /> : <PlotGraph spec={spec} />}
    </ResponsiveContainer>
  )
}

function Title({ text }: { text?: string }) {
  return text ? <text x="50%" y={22} textAnchor="middle" fontSize={16} fontWeight={600} fill="#111827">{text}</text> : null
}

function PlotGraph({ spec, ...rest }: { spec: PlotSpec }) {
  const data = useMemo(() => samplePlot(spec), [spec])
  const [x0, x1] = spec.x
  const [y0, y1] = data.yDomain
  const top = spec.title ? 36 : 12
  return (
    <ComposedChart {...rest} data={data.rows} margin={{ top, right: 20, bottom: 8, left: 0 }}>
      <Title text={spec.title} />
      <CartesianGrid stroke={GRID} />
      <XAxis
        dataKey="x" type="number" domain={[x0, x1]} ticks={data.xTicks} interval={0} allowDataOverflow tick={TICK} tickFormatter={fmt} stroke={FRAME}
        label={{ value: spec.xLabel || 'x', position: 'insideBottomRight', offset: -2, fontStyle: 'italic', fill: '#111827' }}
      />
      <YAxis
        type="number" domain={[y0, y1]} ticks={data.yTicks} interval={0} allowDataOverflow tick={TICK} tickFormatter={fmt} stroke={FRAME} width={48}
        label={{ value: spec.yLabel || 'y', position: 'insideTopLeft', offset: 8, fontStyle: 'italic', fill: '#111827' }}
      />
      {/* The coordinate axes through the origin, when it's in view. */}
      {x0 < 0 && x1 > 0 && <ReferenceLine x={0} stroke={AXIS} strokeWidth={1.3} ifOverflow="hidden" />}
      {y0 < 0 && y1 > 0 && <ReferenceLine y={0} stroke={AXIS} strokeWidth={1.3} ifOverflow="hidden" />}
      {spec.series.map((s, i) => {
        const c = seriesColor(s.color, i)
        const dash = s.dashed ? '7 5' : undefined
        switch (s.kind) {
          case 'area':
            return <Area key={i} dataKey={`s${i}`} name={s.label || `y = ${prettyExpr(s.expr ?? '')}`} type="linear" stroke={c} strokeWidth={2.5} strokeDasharray={dash} fill={c} fillOpacity={0.18} baseValue={0} connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
          case 'fn':
            return <Line key={i} dataKey={`s${i}`} name={s.label || `y = ${prettyExpr(s.expr ?? '')}`} type="linear" stroke={c} strokeWidth={2.5} strokeDasharray={dash} connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
          case 'points':
            return (
              <Scatter key={i} data={s.points} dataKey="y" name={s.label} legendType={s.label ? 'circle' : 'none'} fill={c} isAnimationActive={false}>
                <LabelList dataKey="label" position="top" fill={c} fontSize={13} fontWeight={600} />
              </Scatter>
            )
          case 'line':
            return <Scatter key={i} data={s.points} dataKey="y" name={s.label} legendType={s.label ? 'line' : 'none'} fill={c} line={{ stroke: c, strokeWidth: 2.5, strokeDasharray: dash }} lineType="joint" isAnimationActive={false} />
          case 'vline':
            return <ReferenceLine key={i} x={s.value} stroke={c} strokeWidth={1.8} strokeDasharray={s.dashed === false ? undefined : '7 5'} ifOverflow="hidden" label={{ value: s.label || `x = ${fmt(s.value ?? 0)}`, position: 'insideTopRight', fill: c, fontSize: 12 }} />
          case 'hline':
            return <ReferenceLine key={i} y={s.value} stroke={c} strokeWidth={1.8} strokeDasharray={s.dashed === false ? undefined : '7 5'} ifOverflow="hidden" label={{ value: s.label || `y = ${fmt(s.value ?? 0)}`, position: 'insideTopLeft', fill: c, fontSize: 12 }} />
        }
      })}
      {/* Closed ends of piecewise pieces. */}
      {data.ends.length > 0 && <Scatter data={data.ends} dataKey="y" legendType="none" isAnimationActive={false} shape={(p: { cx?: number; cy?: number; payload?: { series: number } }) => <circle cx={p.cx} cy={p.cy} r={4} fill={seriesColor(spec.series[p.payload?.series ?? 0]?.color, p.payload?.series ?? 0)} />} />}
      <Legend verticalAlign="bottom" iconSize={14} wrapperStyle={{ fontSize: 13, color: '#111827' }} />
    </ComposedChart>
  )
}

function BarGraph({ spec, ...rest }: { spec: BarSpec }) {
  const rows = useMemo(() => barRows(spec), [spec])
  return (
    <ComposedChart {...rest} data={rows} margin={{ top: spec.title ? 36 : 12, right: 20, bottom: 8, left: 0 }}>
      <Title text={spec.title} />
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="name" tick={TICK} stroke={AXIS} interval={0} />
      <YAxis tick={TICK} tickFormatter={fmt} stroke={AXIS} width={48} label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: 'insideLeft', fill: '#111827' } : undefined} />
      {spec.series.map((s, i) => s.kind === 'line'
        ? <Line key={i} dataKey={`b${i}`} name={s.label} type="linear" stroke={seriesColor(s.color, i)} strokeWidth={2.5} dot={{ r: 3.5, fill: seriesColor(s.color, i) }} isAnimationActive={false} />
        : <Bar key={i} dataKey={`b${i}`} name={s.label} fill={seriesColor(s.color, i)} fillOpacity={0.88} radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false} />)}
      {spec.series.some(s => s.label) && <Legend verticalAlign="bottom" iconSize={14} wrapperStyle={{ fontSize: 13, color: '#111827' }} />}
    </ComposedChart>
  )
}

/**
 * PNG of a drawn chart (the <svg> recharts rendered) for Word/PDF — same as the
 * board block's snapshot, stored as a LecturePhoto. 2× for print sharpness.
 */
export async function snapshotChart(host: HTMLElement): Promise<{ blob: Blob; width: number; height: number } | null> {
  // Legend icons are svg.recharts-surface too — the chart is the biggest one.
  const svg = ([...host.querySelectorAll('svg.recharts-surface')] as SVGSVGElement[])
    .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0]
  if (!svg) return null
  const { width, height } = svg.getBoundingClientRect()
  if (!width || !height) return null
  // The legend is HTML next to the svg — fold it in as svg text so the PNG has it.
  const clone = svg.cloneNode(true) as SVGSVGElement
  const legend = host.querySelector('.recharts-legend-wrapper') as HTMLElement | null
  let extra = 0
  if (legend) {
    const items = [...legend.querySelectorAll('.recharts-legend-item')] as HTMLElement[]
    const ns = 'http://www.w3.org/2000/svg'
    const hostBox = svg.getBoundingClientRect()
    for (const item of items) {
      const box = item.getBoundingClientRect()
      const icon = item.querySelector('svg')
      const color = (icon?.querySelector('[fill]:not([fill="none"])')?.getAttribute('fill') ?? icon?.querySelector('[stroke]')?.getAttribute('stroke')) || '#111827'
      const x = box.left - hostBox.left
      const y = box.top - hostBox.top + box.height / 2
      const sw = document.createElementNS(ns, 'rect')
      sw.setAttribute('x', String(x)); sw.setAttribute('y', String(y - 5)); sw.setAttribute('width', '14'); sw.setAttribute('height', '10'); sw.setAttribute('rx', '2'); sw.setAttribute('fill', color)
      const tx = document.createElementNS(ns, 'text')
      tx.setAttribute('x', String(x + 20)); tx.setAttribute('y', String(y + 4.5)); tx.setAttribute('font-size', '13'); tx.setAttribute('fill', '#111827')
      tx.textContent = item.textContent ?? ''
      clone.append(sw, tx)
      extra = Math.max(extra, box.bottom - hostBox.bottom)
    }
  }
  const h = height + Math.max(0, extra) + 4
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(h))
  clone.setAttribute('viewBox', `0 0 ${width} ${h}`)
  clone.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
  clone.style.overflow = 'visible'
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#ffffff')
  clone.insertBefore(bg, clone.firstChild)
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('svg load')); img.src = url })
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, h)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
    return blob ? { blob, width: canvas.width, height: canvas.height } : null
  } finally {
    URL.revokeObjectURL(url)
  }
}
