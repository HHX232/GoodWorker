'use client'

import {
  BoxIcon, CameraIcon, FileTextIcon, Grid3x3Icon, LineChartIcon, MicIcon, SigmaIcon, SparklesIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import s from '../LandingPage.module.scss'
import p from './LecturePromo.module.scss'

// Landing info-block for /lecture ("Конспект лекции"): on the left the pitch
// and the tools, on the right a live-looking card — the microphone hears a
// noisy lecture, the AI strikes out the junk, and the notes write themselves
// with a graph drawing in. The animation plays when the block scrolls into view.

const HREF = '/lecture'

// Markup tags used in the lecturePromo messages.
const rich = {
  x: (c: ReactNode) => <span className={p.noise}>{c}</span>,
  d: (c: ReactNode) => <span className={p.def}>{c}</span>,
  h: (c: ReactNode) => <span className={p.hi}>{c}</span>,
}

/** true once the element has been on screen (then stays true — the drawing plays once). */
function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen]
}

export function LecturePromo() {
  const t = useTranslations('lecturePromo')
  const [ref, inView] = useInView<HTMLDivElement>()
  const tools = [
    ['tool_formulas', SigmaIcon], ['tool_graphs', LineChartIcon], ['tool_matrices', Grid3x3Icon],
    ['tool_board3d', BoxIcon], ['tool_photo', CameraIcon], ['tool_export', FileTextIcon],
  ] as const

  return (
    <section ref={ref} className={`${s.section_grid} ${inView ? p.play : ''}`} aria-labelledby="lecture-promo-title">
      <div>
        <div className={`${s.eyebrow} ${p.eyebrow}`}>{t('eyebrow')}</div>
        <h2 id="lecture-promo-title" className={s.section_h2}>{t('h2')} <span className={p.violet}>{t('h2_hl')}</span></h2>
        <p className={s.section_text}>{t('lead')}</p>
        <div className={p.tools}>
          {tools.map(([k, Icon], i) => (
            <div key={k} className={p.tool} style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
              <span className={p.toolIcon}><Icon size={17} /></span>{t(k)}
            </div>
          ))}
        </div>
        <div className={p.ctaRow}>
          <Link href={HREF} className={p.cta}><MicIcon size={18} />{t('cta_start')}</Link>
          <span className={p.vipNote}>{t('vip_note')}</span>
        </div>
      </div>

      <div className={p.card}>
        <div className={p.recTop}>
          <div className={p.orb} aria-hidden><i /><i /><i /><b /></div>
          <div className={p.recMeta}>{t('rec')}<strong>41:07</strong></div>
          <div className={p.wave} aria-hidden>{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ animationDelay: `${(i * 0.13) % 0.7}s` }} />)}</div>
        </div>
        <div className={p.raw}>{t.rich('raw', rich)}</div>
        <div className={p.arrow}><SparklesIcon size={13} /> {t('arrow')}</div>
        <div className={p.note}>
          <div className={`${p.noteTitle} ${p.rise}`} style={{ animationDelay: '1.1s' }}>{t('note_title')}</div>
          <p className={p.rise} style={{ animationDelay: '1.35s' }}>{t.rich('note_text', rich)}</p>
          <MiniGraph />
        </div>
      </div>
    </section>
  )
}

// Plot box: x ∈ [−3, 4], y ∈ [−5, 9] → 420 × 130.
const GW = 420
const GH = 130
const gx = (x: number) => ((x + 3) / 7) * GW
const gy = (y: number) => GH - ((y + 5) / 14) * GH
const f1 = (x: number) => x * x - 4
const f2 = (x: number) => 2 * x
const A = 1 - Math.sqrt(5)
const B = 1 + Math.sqrt(5)
const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('-', '−')

/**
 * y = x² − 4, y = 2x and the area between them — drawn stroke by stroke when
 * the block comes into view, then live: hover (or touch) reads both curves at
 * that x, and inside the shaded area shows how far apart they are.
 */
function MiniGraph() {
  const [hx, setHx] = useState<number | null>(null)
  const para = Array.from({ length: 71 }, (_, i) => { const x = -3 + i * 0.1; return `${i ? 'L' : 'M'}${gx(x).toFixed(1)} ${gy(f1(x)).toFixed(1)}` }).join('')
  const area = Array.from({ length: 41 }, (_, i) => { const x = A + ((B - A) * i) / 40; return `${i ? 'L' : 'M'}${gx(x).toFixed(1)} ${gy(f2(x)).toFixed(1)}` }).join('')
    + Array.from({ length: 41 }, (_, i) => { const x = B - ((B - A) * i) / 40; return `L${gx(x).toFixed(1)} ${gy(f1(x)).toFixed(1)}` }).join('') + 'Z'

  const track = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 7 - 3
    setHx(Math.max(-3, Math.min(4, Math.round(x * 10) / 10)))
  }
  const inside = hx !== null && hx >= A && hx <= B
  const clampY = (y: number) => Math.max(4, Math.min(GH - 4, gy(y)))
  const tipLeft = hx !== null && gx(hx) > GW * 0.62

  return (
    <div className={p.graphWrap}>
      <svg
        className={p.graph}
        viewBox={`0 0 ${GW} ${GH}`}
        role="img"
        aria-label="y = x² − 4, y = 2x"
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setHx(null) }}
      >
        <g className={p.gGrid}>
          {[-2, -1, 1, 2, 3].map(x => <line key={x} className={p.gridLine} x1={gx(x)} y1={0} x2={gx(x)} y2={GH} />)}
          {[-4, 4, 8].map(y => <line key={y} className={p.gridLine} x1={0} y1={gy(y)} x2={GW} y2={gy(y)} />)}
        </g>
        <line className={`${p.axisLine} ${p.draw} ${p.dAxisX}`} pathLength={1} x1={0} y1={gy(0)} x2={GW} y2={gy(0)} />
        <line className={`${p.axisLine} ${p.draw} ${p.dAxisY}`} pathLength={1} x1={gx(0)} y1={GH} x2={gx(0)} y2={0} />
        <path className={`${p.gArea} ${inside ? p.gAreaOn : ''}`} d={area} />
        <path className={`${p.draw} ${p.dPara}`} pathLength={1} d={para} fill="none" stroke="#7c3aed" strokeWidth={3} strokeLinecap="round" />
        <line className={`${p.draw} ${p.dLine}`} pathLength={1} x1={gx(-2.5)} y1={gy(-5)} x2={gx(4)} y2={gy(8)} stroke="#ed0606" strokeWidth={3} strokeLinecap="round" />
        {[[A, f2(A)], [B, f2(B)]].map(([x, y], i) => (
          <circle key={i} className={p.gDot} style={{ animationDelay: `${3.1 + i * 0.15}s` }} cx={gx(x)} cy={gy(y)} r={4.5} fill="#6366f1" stroke="#fff" strokeWidth={1.5} />
        ))}
        {hx !== null && (
          <g className={p.probe} pointerEvents="none">
            <line x1={gx(hx)} y1={0} x2={gx(hx)} y2={GH} className={p.probeLine} />
            {inside && <line x1={gx(hx)} y1={gy(f2(hx))} x2={gx(hx)} y2={gy(f1(hx))} className={p.probeGap} />}
            <circle cx={gx(hx)} cy={clampY(f1(hx))} r={4.5} fill="#7c3aed" stroke="#fff" strokeWidth={1.5} />
            <circle cx={gx(hx)} cy={clampY(f2(hx))} r={4.5} fill="#ed0606" stroke="#fff" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {hx !== null && (
        <div className={`${p.probeTip} ${tipLeft ? p.probeTipLeft : ''}`} style={{ left: `${(gx(hx) / GW) * 100}%` }}>
          <b>x = {fmt(hx)}</b>
          <span><i className={p.dotViolet} />y₁ = {fmt(f1(hx))}</span>
          <span><i className={p.dotRed} />y₂ = {fmt(f2(hx))}</span>
          {inside && <span className={p.probeGapText}>y₂ − y₁ = {fmt(f2(hx) - f1(hx))}</span>}
        </div>
      )}
    </div>
  )
}
