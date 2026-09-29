'use client'

import {
  BoxIcon, CameraIcon, FileTextIcon, Grid3x3Icon, LineChartIcon, MicIcon, SigmaIcon, SparklesIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
        <div className={s.eyebrow}>{t('eyebrow')}</div>
        <h2 id="lecture-promo-title" className={s.section_h2}>{t('h2')} <span className={p.red}>{t('h2_hl')}</span></h2>
        <p className={s.section_text}>{t('lead')}</p>
        <div className={p.tools}>
          {tools.map(([k, Icon], i) => (
            <div key={k} className={p.tool} style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
              <span className={p.toolIcon}><Icon size={17} /></span>{t(k)}
            </div>
          ))}
        </div>
        <div className={p.ctaRow}>
          <Link href={HREF} className={s.btn_red}><MicIcon size={17} />{t('cta_start')}</Link>
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

/** y = x² − 4, y = 2x and the area between them — drawn stroke by stroke when the block comes into view. */
function MiniGraph() {
  // Plot box: x ∈ [−3, 4], y ∈ [−5, 9] → 420 × 170.
  const X = (x: number) => ((x + 3) / 7) * 420
  const Y = (y: number) => 170 - ((y + 5) / 14) * 170
  const para = Array.from({ length: 71 }, (_, i) => { const x = -3 + i * 0.1; return `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(x * x - 4).toFixed(1)}` }).join('')
  const a = 1 - Math.sqrt(5)
  const b = 1 + Math.sqrt(5)
  const area = Array.from({ length: 41 }, (_, i) => { const x = a + ((b - a) * i) / 40; return `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(2 * x).toFixed(1)}` }).join('')
    + Array.from({ length: 41 }, (_, i) => { const x = b - ((b - a) * i) / 40; return `L${X(x).toFixed(1)} ${Y(x * x - 4).toFixed(1)}` }).join('') + 'Z'
  return (
    <svg className={p.graph} viewBox="0 0 420 170" role="img" aria-label="y = x² − 4, y = 2x">
      <g className={p.gGrid}>
        {[-2, -1, 1, 2, 3].map(x => <line key={x} className={p.gridLine} x1={X(x)} y1={0} x2={X(x)} y2={170} />)}
        {[-4, 4, 8].map(y => <line key={y} className={p.gridLine} x1={0} y1={Y(y)} x2={420} y2={Y(y)} />)}
      </g>
      <line className={`${p.axisLine} ${p.draw} ${p.dAxisX}`} pathLength={1} x1={0} y1={Y(0)} x2={420} y2={Y(0)} />
      <line className={`${p.axisLine} ${p.draw} ${p.dAxisY}`} pathLength={1} x1={X(0)} y1={170} x2={X(0)} y2={0} />
      <path className={p.gArea} d={area} fill="#16a34a" fillOpacity={0.18} />
      <path className={`${p.draw} ${p.dPara}`} pathLength={1} d={para} fill="none" stroke="#2563eb" strokeWidth={3} strokeLinecap="round" />
      <line className={`${p.draw} ${p.dLine}`} pathLength={1} x1={X(-2.5)} y1={Y(-5)} x2={X(4)} y2={Y(8)} stroke="#dc2626" strokeWidth={3} strokeLinecap="round" />
      {[[a, 2 * a], [b, 2 * b]].map(([x, y], i) => (
        <circle key={i} className={p.gDot} style={{ animationDelay: `${3.1 + i * 0.15}s` }} cx={X(x)} cy={Y(y)} r={4.5} fill="#ea580c" stroke="#fff" strokeWidth={1.5} />
      ))}
    </svg>
  )
}
