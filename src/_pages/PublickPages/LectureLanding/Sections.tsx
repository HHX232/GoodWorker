'use client'

import {
  AudioLinesIcon, BoxIcon, CameraIcon, ChevronRightIcon, EyeIcon, FileTextIcon, FolderIcon, Grid3x3Icon, LayersIcon,
  LineChartIcon, LinkIcon, NotebookPenIcon, PencilIcon, SigmaIcon, SparklesIcon, type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DocBlocks, type Block } from './Doc'
import { StartButton } from './shared'
import s from './LectureLanding.module.scss'

// ── 2. Конспект + Файлы ──────────────────────────────────────────────────

interface FileItem { s: number; name: string; kind: 'doc' | 'audio'; meta: string }
const POINT_ICONS: LucideIcon[] = [FolderIcon, SparklesIcon, AudioLinesIcon, LinkIcon]

/** Notes file themselves: a living drive — subject filter, a recording with its chapters, share links. */
export function FilesBundle() {
  const t = useTranslations('lectureLanding.files')
  const subjects = t.raw('subjects') as string[]
  const items = t.raw('items') as FileItem[]
  const points = t.raw('points') as { t: string; d: string }[]
  const chapters = t.raw('chapterList') as string[]
  const [subject, setSubject] = useState<number | null>(0)
  const [open, setOpen] = useState<number | null>(1)
  const shown = items.map((it, i) => ({ ...it, i })).filter(it => subject === null || it.s === subject)

  return (
    <section className={s.section}>
      <div className={`${s.wrap} ${s.split}`}>
        <div>
          <div className={s.eyebrow}><NotebookPenIcon size={14} /> {t('eyebrow')}</div>
          <h2 className={s.h2}>{t('h2')} <span className={s.hl}>{t('h2Hl')}</span></h2>
          <p className={s.lead}>{t('lead')}</p>
          <div className={s.points}>
            {points.map((p, i) => {
              const Icon = POINT_ICONS[i] ?? FolderIcon
              return <div key={p.t} className={s.point}><span className={s.pointIcon}><Icon size={17} /></span><div><strong>{p.t}</strong><p>{p.d}</p></div></div>
            })}
          </div>
          <p className={s.tutorNote}>{t('tutor')}</p>
        </div>

        <div className={s.drive}>
          <div className={s.driveTop}>
            <span className={s.crumb}><FolderIcon size={16} /> {t('tree')} {subject !== null && <><ChevronRightIcon size={14} /> <small>{subjects[subject]}</small></>}</span>
            <button type="button" className={`${s.subject} ${subject === null ? s.subjectOn : ''}`} onClick={() => setSubject(null)}>{t('all')}</button>
            {subjects.map((name, i) => (
              <button key={name} type="button" className={`${s.subject} ${subject === i ? s.subjectOn : ''}`} onClick={() => setSubject(i)}>{name}</button>
            ))}
          </div>
          <div className={s.fileList}>
            {shown.map(it => (
              <div key={`${subject}-${it.i}`}>
                {it.kind === 'audio' ? (
                  <button type="button" className={s.fileRow} style={{ width: '100%' }} onClick={() => setOpen(open === it.i ? null : it.i)} aria-expanded={open === it.i}>
                    <span className={`${s.fileIcon} ${s.fileAudio}`}><AudioLinesIcon size={18} /></span>
                    <span className={s.fileName}><strong>{it.name}</strong><small>{it.meta}</small></span>
                    <ChevronRightIcon size={16} style={{ transform: open === it.i ? 'rotate(90deg)' : undefined, transition: 'transform .2s' }} />
                  </button>
                ) : (
                  <div className={s.fileRow}>
                    <span className={`${s.fileIcon} ${s.fileDoc}`}><FileTextIcon size={18} /></span>
                    <span className={s.fileName}><strong>{it.name}</strong><small>{it.meta}</small></span>
                    <span className={s.fileTag}>{t('noteTag')}</span>
                  </div>
                )}
                {it.kind === 'audio' && open === it.i && (
                  <div className={s.chapters}><div style={{ fontFamily: 'inherit', fontWeight: 700, marginBottom: 2 }}>{t('chapters')}</div>{chapters.map(c => <div key={c}>{c}</div>)}</div>
                )}
              </div>
            ))}
          </div>
          <div className={s.driveFoot}>
            <strong>{t('share')}:</strong>
            <span className={s.sharePill}><EyeIcon size={14} /> {t('shareView')}</span>
            <span className={s.sharePill}><PencilIcon size={14} /> {t('shareEdit')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 3. Примеры ───────────────────────────────────────────────────────────

export function Examples() {
  const t = useTranslations('lectureLanding.examples')
  const tabs = t.raw('tabs') as string[]
  const docs = t.raw('docs') as Block[][]
  const [tab, setTab] = useState(0)
  return (
    <section className={s.section} style={{ paddingTop: 24 }}>
      <div className={s.wrap}>
        <div className={s.eyebrow}><FileTextIcon size={14} /> {t('eyebrow')}</div>
        <h2 className={s.h2}>{t('h2')}</h2>
        <p className={s.lead}>{t('lead')}</p>
        <div className={s.exTabs} role="tablist">
          {tabs.map((name, i) => <button key={name} type="button" role="tab" aria-selected={tab === i} className={`${s.exTab} ${tab === i ? s.exTabOn : ''}`} onClick={() => setTab(i)}>{name}</button>)}
        </div>
        <div className={s.exWrap}>
          <div className={s.paper}><DocBlocks key={tab} blocks={docs[tab]} /></div>
          <div className={s.exAside}>
            <div className={s.exBadge}><FileTextIcon size={18} color="#7c3aed" /> Word · PDF</div>
            <div className={s.exBadge}><AudioLinesIcon size={18} color="#ea580c" /> .m4a</div>
            <p style={{ margin: 0 }}>{t('exports')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 4. Как работает · возможности · для кого · финал ──────────────────────

const FEATURE_ICONS: Record<string, LucideIcon> = {
  sigma: SigmaIcon, chart: LineChartIcon, grid: Grid3x3Icon, box: BoxIcon, camera: CameraIcon, sparkles: SparklesIcon, layers: LayersIcon, audio: AudioLinesIcon, link: LinkIcon,
}

export function HowItWorks() {
  const t = useTranslations('lectureLanding.how')
  const steps = t.raw('steps') as { t: string; d: string }[]
  return (
    <section className={s.section} style={{ paddingTop: 24 }}>
      <div className={s.wrap}>
        <div className={s.eyebrow}>{t('eyebrow')}</div>
        <h2 className={s.h2}>{t('h2')}</h2>
        <div className={s.steps}>
          {steps.map((st, i) => (
            <div key={st.t} className={`${s.step} ${i === 0 || i === 3 ? s.stepMine : ''}`}>
              <span className={s.stepNum}>{i + 1}</span>
              <strong>{st.t}</strong>
              <p>{st.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Features() {
  const t = useTranslations('lectureLanding')
  const items = t.raw('features.items') as { i: string; t: string; d: string }[]
  return (
    <section className={s.section} style={{ paddingTop: 24 }}>
      <div className={s.wrap}>
        <div className={s.eyebrow}>{t('features.eyebrow')}</div>
        <h2 className={s.h2}>{t('features.h2')}</h2>
        <div className={s.features}>
          {items.map(f => {
            const Icon = FEATURE_ICONS[f.i] ?? SparklesIcon
            return <div key={f.t} className={s.feature}><span className={s.featureIcon}><Icon size={19} /></span><div><strong>{f.t}</strong><p>{f.d}</p></div></div>
          })}
        </div>
        <div className={s.who}>
          {(['student', 'tutor'] as const).map(k => <div key={k} className={s.whoCard}><strong>{t(`who.${k}.t`)}</strong><p>{t(`who.${k}.d`)}</p></div>)}
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  const t = useTranslations('lectureLanding.final')
  return (
    <section className={s.final}>
      <div className={s.wrap}>
        <h2 className={s.h2}>{t('h2')}</h2>
        <p className={s.lead}>{t('lead')}</p>
        <div className={s.ctaRow}><StartButton label={t('cta')} /></div>
      </div>
    </section>
  )
}
