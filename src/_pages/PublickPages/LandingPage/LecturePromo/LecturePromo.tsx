'use client'

import {
  BoxIcon, CameraIcon, FileTextIcon, Grid3x3Icon, LineChartIcon, MicIcon, SigmaIcon, SparklesIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import type { ReactNode } from 'react'
import s from '../LandingPage.module.scss'
import p from './LecturePromo.module.scss'

// Landing info-block for /lecture ("Конспект лекции"). Four looks of the same
// message — the landing shows one (LECTURE_PROMO_DEFAULT), `?lecturePromo=a|b|c|d`
// previews the others on the live page.

export type LecturePromoVariant = 'a' | 'b' | 'c' | 'd'
export const LECTURE_PROMO_DEFAULT: LecturePromoVariant = 'b'
const HREF = '/lecture'

// Markup tags used in the lecturePromo messages.
const rich = {
  hl: (c: ReactNode) => <span className={p.mark}>{c}</span>,
  x: (c: ReactNode) => <span className={p.noise}>{c}</span>,
  d: (c: ReactNode) => <span className={p.def}>{c}</span>,
  h: (c: ReactNode) => <span className={p.hi}>{c}</span>,
}

function Cta({ label, withMic }: { label: string; withMic?: boolean }) {
  const t = useTranslations('lecturePromo')
  return (
    <div className={p.ctaRow}>
      <Link href={HREF} className={s.btn_red}>
        {withMic && <MicIcon size={17} />}
        {label}
      </Link>
      <span className={p.vipNote}>{t('vip_note')}</span>
    </div>
  )
}

export function LecturePromo({ variant = LECTURE_PROMO_DEFAULT }: { variant?: LecturePromoVariant }) {
  return (
    <section data-lecture-promo={variant} aria-labelledby="lecture-promo-title">
      {variant === 'a' ? <PromoA /> : variant === 'c' ? <PromoC /> : variant === 'd' ? <PromoD /> : <PromoB />}
    </section>
  )
}

// ─── A · live microphone ─────────────────────────────────────
function PromoA() {
  const t = useTranslations('lecturePromo')
  const tags = ['tool_formulas', 'tool_graphs', 'tool_matrices', 'tool_board3d', 'tool_photo', 'tool_export'] as const
  return (
    <div className={s.section_grid}>
      <div>
        <div className={s.eyebrow}>{t('a_eyebrow')}</div>
        <h2 id="lecture-promo-title" className={s.section_h2}>{t('a_h2')} <span className={p.red}>{t('a_h2_hl')}</span></h2>
        <p className={s.section_text}>{t.rich('a_p1', rich)}</p>
        <p className={s.section_text}>{t('a_p2')}</p>
        <div className={s.tag_row}>{tags.map(k => <span key={k} className={s.tag_chip}>{t(k)}</span>)}</div>
        <Cta label={t('cta_start')} withMic />
      </div>
      <div className={p.card}>
        <div className={p.recTop}>
          <div className={p.orb} aria-hidden><i /><i /><i /><b /></div>
          <div className={p.recMeta}>{t('a_rec')}<strong>41:07</strong></div>
          <div className={p.wave} aria-hidden>{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ animationDelay: `${(i * 0.13) % 0.7}s` }} />)}</div>
        </div>
        <div className={p.raw}>{t.rich('a_raw', rich)}</div>
        <div className={p.arrow}><SparklesIcon size={13} /> {t('a_arrow')}</div>
        <div className={p.note}>
          <div className={p.noteTitle}>{t('a_note_title')}</div>
          <p>{t.rich('a_note_text', rich)}</p>
          <div className={p.formula}>(f(g(x)))′ = f′(g(x)) · g′(x)</div>
        </div>
      </div>
    </div>
  )
}

// ─── B · before → after ──────────────────────────────────────
function PromoB() {
  const t = useTranslations('lecturePromo')
  return (
    <div>
      <div className={p.centerHead}>
        <div className={s.eyebrow}>{t('b_eyebrow')}</div>
        <h2 id="lecture-promo-title" className={s.section_h2}>{t('b_h2')} <span className={p.red}>{t('b_h2_hl')}</span></h2>
        <p className={`${s.section_text} ${p.centerText}`}>{t.rich('b_p', rich)}</p>
      </div>
      <div className={p.split}>
        <div className={p.before}>
          <span className={p.lbl}>{t('b_before_lbl')}</span>
          {t.rich('b_before', rich)}
        </div>
        <div className={p.splitArrow} aria-hidden><span>→</span></div>
        <div className={p.after}>
          <span className={`${p.lbl} ${p.lblRed}`}>{t('b_after_lbl')}</span>
          <div className={p.noteTitle}>{t('b_after_title')}</div>
          <p className={p.afterText}>{t.rich('b_after_text', rich)}</p>
          <MiniGraph />
        </div>
      </div>
      <div className={p.stats}>
        {([['b_stat1', 'b_stat1_l'], ['b_stat2', 'b_stat2_l'], ['b_stat3', 'b_stat3_l']] as const).map(([n, l]) => (
          <div key={n}><strong>{t(n)}</strong><span>{t(l)}</span></div>
        ))}
      </div>
      <div className={p.centerCta}><Cta label={t('cta_record')} withMic /></div>
    </div>
  )
}

/** y = x² − 4 and y = 2x with the area between them — the same picture the graph block draws. */
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
      {[-2, -1, 1, 2, 3].map(x => <line key={x} className={p.gridLine} x1={X(x)} y1={0} x2={X(x)} y2={170} />)}
      {[-4, 4, 8].map(y => <line key={y} className={p.gridLine} x1={0} y1={Y(y)} x2={420} y2={Y(y)} />)}
      <line className={p.axisLine} x1={0} y1={Y(0)} x2={420} y2={Y(0)} />
      <line className={p.axisLine} x1={X(0)} y1={0} x2={X(0)} y2={170} />
      <path d={area} fill="#16a34a" fillOpacity={0.18} />
      <path d={para} fill="none" stroke="#2563eb" strokeWidth={3} />
      <line x1={X(-2.5)} y1={Y(-5)} x2={X(4)} y2={Y(8)} stroke="#dc2626" strokeWidth={3} />
    </svg>
  )
}

// ─── C · the notebook that writes itself ─────────────────────
function PromoC() {
  const t = useTranslations('lecturePromo')
  const tools = [
    ['tool_formulas', SigmaIcon], ['tool_graphs', LineChartIcon], ['tool_matrices', Grid3x3Icon],
    ['tool_board3d', BoxIcon], ['tool_photo', CameraIcon], ['tool_export', FileTextIcon],
  ] as const
  return (
    <div className={s.section_grid}>
      <div>
        <div className={s.eyebrow}>{t('c_eyebrow')}</div>
        <h2 id="lecture-promo-title" className={s.section_h2}>{t('c_h2')} <span className={p.red}>{t('c_h2_hl')}</span></h2>
        <p className={s.section_text}>{t('c_p')}</p>
        <div className={p.tools}>
          {tools.map(([k, Icon]) => <div key={k} className={p.tool}><Icon size={17} />{t(k)}</div>)}
        </div>
        <Cta label={t('cta_open')} />
      </div>
      <div className={p.pageWrap}>
        <div className={p.page}>
          <div className={p.sticker}>{t('c_sticker')}</div>
          <div className={p.pageTitle}>{t('c_title')}</div>
          <div className={`${p.line} ${p.typing}`}>{t.rich('c_line1', rich)}</div>
          <div className={p.line}>{t('c_example')}</div>
          <div className={p.matrices}>
            <Matrix name="A" rows={[['2', '1'], ['5', '3']]} />
            <Matrix name="A⁻¹" rows={[['3', '−1'], ['−5', '2']]} />
          </div>
          <div className={p.line}>{t.rich('c_check', rich)}</div>
          <div className={`${p.line} ${p.lineMuted}`}>det A = 2·3 − 1·5 = 1</div>
        </div>
      </div>
    </div>
  )
}

function Matrix({ name, rows }: { name: string; rows: string[][] }) {
  return (
    <span className={p.matrix}>
      <i>{name}</i> =
      <span className={p.mBody}>
        {rows.map((r, i) => <span key={i} className={p.mRow}>{r.map((c, j) => <span key={j}>{c}</span>)}</span>)}
      </span>
    </span>
  )
}

// ─── D · the lecture on a timeline ───────────────────────────
function PromoD() {
  const t = useTranslations('lecturePromo')
  const pins = [
    { at: 12, tk: 'd_pin1_t', k: 'd_pin1' }, { at: 37, tk: 'd_pin2_t', k: 'd_pin2' },
    { at: 63, tk: 'd_pin3_t', k: 'd_pin3' }, { at: 88, tk: 'd_pin4_t', k: 'd_pin4' },
  ] as const
  const bars = Array.from({ length: 120 }, (_, i) => 18 + Math.abs(Math.sin(i * 0.37) * 34 + Math.sin(i * 1.3) * 12))
  return (
    <div>
      <div className={p.dHead}>
        <div>
          <div className={s.eyebrow}>{t('d_eyebrow')}</div>
          <h2 id="lecture-promo-title" className={s.section_h2}>{t('d_h2')} <span className={p.red}>{t('d_h2_hl')}</span></h2>
        </div>
        <p className={s.section_text}>{t.rich('d_p', rich)}</p>
      </div>
      <div className={p.track}>
        <div className={p.pins}>
          {pins.map((pin, i) => (
            <div key={pin.k} className={p.pin} style={{ left: `${pin.at}%`, animationDelay: `${0.15 + i * 0.3}s` }}>
              <span className={p.pinTime}>{t(pin.tk)}</span>
              {t(pin.k)}
            </div>
          ))}
        </div>
        <div className={p.timeWave} aria-hidden>
          {bars.map((h, i) => <span key={i} className={i < 100 ? p.done : ''} style={{ height: h }} />)}
        </div>
        <div className={p.times}>{['0:00', '15:00', '30:00', '45:00', '60:00', '75:00', '90:00'].map(x => <span key={x}>{x}</span>)}</div>
      </div>
      <div className={p.dFoot}>
        <div className={p.formats}>
          <span className={p.fmt}><b className={p.fmtWord}>W</b>Word</span>
          <span className={p.fmt}><b className={p.fmtPdf}>PDF</b>PDF</span>
          <span className={p.fmt}><b className={p.fmtAudio}>m4a</b>{t('tool_audio')}</span>
        </div>
        <Cta label={t('cta_record')} withMic />
      </div>
    </div>
  )
}
