'use client'

import { useEffect, useState } from 'react'
import 'mathlive/static.css'
import s from './LectureLanding.module.scss'

// The landing's notes are plain data (from lectureLanding.* messages), drawn
// like the real document: headings, definitions, highlights, formulas via
// mathlive (the editor's renderer, without pulling the editor in).

export type Block =
  | { t: 'h'; v: string }
  | { t: 'p'; v: string }
  | { t: 'def'; v: string }
  | { t: 'warn'; v: string }
  | { t: 'li'; v: string[] }
  | { t: 'math'; v: string }
  | { t: 'table'; v: string[][] }
  | { t: 'graph' }
  | { t: 'board' }

const cache = new Map<string, string>()

export function Formula({ latex, inline = false }: { latex: string; inline?: boolean }) {
  const key = `${inline ? 'i' : 'b'}:${latex}`
  const [html, setHtml] = useState<string | null>(() => cache.get(key) ?? null)
  useEffect(() => {
    if (cache.has(key)) { setHtml(cache.get(key)!); return }
    let alive = true
    import('mathlive').then(({ convertLatexToMarkup }) => {
      const out = convertLatexToMarkup(latex, { defaultMode: inline ? 'inline-math' : 'math' })
      cache.set(key, out)
      if (alive) setHtml(out)
    }).catch(() => {})
    return () => { alive = false }
  }, [key, latex, inline])
  return html ? <span className={inline ? s.mathInline : s.mathBlock} dangerouslySetInnerHTML={{ __html: html }} /> : <code className={inline ? s.mathInline : s.mathBlock}>{latex}</code>
}

/** Text with $…$ inline formulas and ==highlight== (a highlight may hold formulas: ==det $A \neq 0$==). */
export function Rich({ text }: { text: string }) {
  const withMath = (part: string, key: string) =>
    part.split(/(\$[^$]+\$)/g).filter(Boolean).map((p, i) =>
      p.startsWith('$') && p.endsWith('$') && p.length > 1 ? <Formula key={`${key}-${i}`} latex={p.slice(1, -1)} inline /> : <span key={`${key}-${i}`}>{p}</span>)
  return (
    <>
      {text.split(/(==.+?==)/g).filter(Boolean).map((p, i) =>
        p.startsWith('==') && p.endsWith('==') && p.length > 4
          ? <mark key={i} className={s.mark}>{withMath(p.slice(2, -2), String(i))}</mark>
          : withMath(p, String(i)))}
    </>
  )
}

/** y = x² − 4 and y = 2x with the area between — the same drawing as the notes' graph block. */
export function MiniGraph() {
  const W = 360, H = 150
  const gx = (x: number) => ((x + 3) / 7) * W
  const gy = (y: number) => H - ((y + 5) / 14) * H
  const A = 1 - Math.sqrt(5), B = 1 + Math.sqrt(5)
  const para = Array.from({ length: 71 }, (_, i) => { const x = -3 + i * 0.1; return `${i ? 'L' : 'M'}${gx(x).toFixed(1)} ${gy(x * x - 4).toFixed(1)}` }).join('')
  const area = Array.from({ length: 41 }, (_, i) => { const x = A + ((B - A) * i) / 40; return `${i ? 'L' : 'M'}${gx(x).toFixed(1)} ${gy(2 * x).toFixed(1)}` }).join('')
    + Array.from({ length: 41 }, (_, i) => { const x = B - ((B - A) * i) / 40; return `L${gx(x).toFixed(1)} ${gy(x * x - 4).toFixed(1)}` }).join('') + 'Z'
  return (
    <svg className={s.graph} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="y = x² − 4, y = 2x">
      {[-2, -1, 1, 2, 3].map(x => <line key={x} x1={gx(x)} y1={0} x2={gx(x)} y2={H} className={s.gridLine} />)}
      {[-4, 4, 8].map(y => <line key={y} x1={0} y1={gy(y)} x2={W} y2={gy(y)} className={s.gridLine} />)}
      <line x1={0} y1={gy(0)} x2={W} y2={gy(0)} className={s.axis} />
      <line x1={gx(0)} y1={0} x2={gx(0)} y2={H} className={s.axis} />
      <path d={area} className={s.area} />
      <path d={para} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={gx(-2.5)} y1={gy(-5)} x2={gx(4)} y2={gy(8)} stroke="#e11d48" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}
/** A pyramid on the 3D board, as the board block's snapshot shows it. */
export function MiniBoard() {
  return (
    <svg className={s.boardSvg} viewBox="0 0 360 170" role="img" aria-label="SABCD">
      <rect x="0" y="0" width="360" height="170" rx="12" className={s.boardBg} />
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M70 140 L200 150 L250 118 L120 110 Z" />
        <path d="M150 28 L70 140 M150 28 L200 150 M150 28 L250 118" />
        <path d="M150 28 L120 110" strokeDasharray="4 4" />
        <path d="M150 28 L160 130" stroke="#7c3aed" strokeDasharray="3 3" />
      </g>
      <g className={s.boardLabels}>
        <text x="142" y="22">S</text><text x="56" y="152">A</text><text x="200" y="165">B</text><text x="256" y="120">C</text><text x="108" y="106">D</text>
        <text x="166" y="92" fill="#7c3aed">h</text>
      </g>
    </svg>
  )
}

export function DocBlocks({ blocks, fresh }: { blocks: Block[]; fresh?: Set<number> }) {
  return (
    <div className={s.doc}>
      {blocks.map((b, i) => {
        const cls = fresh?.has(i) ? s.fresh : undefined
        switch (b.t) {
          case 'h': return <h4 key={i} className={`${s.docH} ${cls ?? ''}`}><Rich text={b.v} /></h4>
          case 'p': return <p key={i} className={cls}><Rich text={b.v} /></p>
          case 'def': return <p key={i} className={`${s.def} ${cls ?? ''}`}><Rich text={b.v} /></p>
          case 'warn': return <p key={i} className={`${s.warn} ${cls ?? ''}`}><Rich text={b.v} /></p>
          case 'li': return <ul key={i} className={cls}>{b.v.map((x, j) => <li key={j}><Rich text={x} /></li>)}</ul>
          case 'math': return <div key={i} className={`${s.mathCard} ${cls ?? ''}`}><Formula latex={b.v} /></div>
          case 'table': return (
            <table key={i} className={`${s.table} ${cls ?? ''}`}>
              <thead><tr>{b.v[0].map((c, j) => <th key={j}><Rich text={c} /></th>)}</tr></thead>
              <tbody>{b.v.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}><Rich text={c} /></td>)}</tr>)}</tbody>
            </table>
          )
          case 'graph': return <div key={i} className={`${s.blockCard} ${cls ?? ''}`}><MiniGraph /></div>
          case 'board': return <div key={i} className={`${s.blockCard} ${cls ?? ''}`}><MiniBoard /></div>
        }
      })}
    </div>
  )
}
