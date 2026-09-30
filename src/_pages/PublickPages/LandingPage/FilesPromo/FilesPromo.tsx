'use client'

import {
  CalendarDaysIcon, CheckIcon, ClockIcon, EyeIcon, FileAudioIcon, FileImageIcon, FileTextIcon, FolderIcon,
  FolderOpenIcon, GraduationCapIcon, PenLineIcon, SearchIcon, UploadIcon, UserIcon, UsersIcon, XIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Fragment, useEffect, useRef, useState } from 'react'
import s from '../LandingPage.module.scss'
import f from './FilesPromo.module.scss'

// Landing info-block for /files (the tutor's storage). Three variants are on
// the page for comparison (the A/B/C pill in the corner of the block):
//   A — «Проводник»: a working mini file manager with search inside files;
//   B — «Сдача работ»: deadline folder → who handed in → pen review → returned;
//   C — «Две стороны»: the same library as the tutor and as the student sees it.

const HREF = '/files'
type Variant = 'a' | 'b' | 'c'
type Kind = 'pdf' | 'docx' | 'audio' | 'img'
interface FileRow { name: string; kind: Kind; meta: string }
interface Folder { name: string; access: string; files: FileRow[] }
interface Query { q: string; hits: { file: string; folder: string; snippet: string }[] }
interface Row { name: string; meta: string }
interface Student { name: string; status: 'ok' | 'late' | 'none'; label: string }

/** true once the block has been on screen. */
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

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(m.matches)
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

const KIND_ICON = { pdf: FileTextIcon, docx: FileTextIcon, audio: FileAudioIcon, img: FileImageIcon } as const

function FileIcon({ kind }: { kind: Kind }) {
  const Icon = KIND_ICON[kind]
  return <span className={`${f.fileIcon} ${f[`k_${kind}`]}`}><Icon size={16} /></span>
}

/** ==word== → highlighted. */
function Marked({ text }: { text: string }) {
  return <>{text.split(/(==.+?==)/).map((part, i) => part.startsWith('==') ? <mark key={i} className={f.mark}>{part.slice(2, -2)}</mark> : <Fragment key={i}>{part}</Fragment>)}</>
}

function Copy({ v }: { v: Variant }) {
  const t = useTranslations('filesPromo')
  return (
    <div>
      <div className={s.eyebrow}>{t('eyebrow')}</div>
      <h2 id="files-promo-title" className={s.section_h2}>{t(`${v}.h2`)} <span className={f.red}>{t(`${v}.h2_hl`)}</span></h2>
      <p className={s.section_text}>{t(`${v}.lead`)}</p>
      {v === 'c' && (
        <ul className={f.points}>
          {(t.raw('c.points') as string[]).map(p => <li key={p}><CheckIcon size={15} /> {p}</li>)}
        </ul>
      )}
      <div className={f.ctaRow}>
        <Link href={HREF} className={s.btn_red}><FolderOpenIcon size={17} />{t('cta')}</Link>
        <span className={f.vipNote}>{t('vip')}</span>
      </div>
    </div>
  )
}

// ─── A: the explorer ─────────────────────────────────
function Explorer() {
  const t = useTranslations('filesPromo.a')
  const folders = t.raw('folders') as Folder[]
  const queries = t.raw('queries') as Query[]
  const [open, setOpen] = useState(0)
  const [query, setQuery] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const reduced = useReducedMotion()
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  // The query types itself into the field, then the hits show.
  const search = (i: number) => {
    if (timer.current) clearInterval(timer.current)
    setQuery(i)
    const word = queries[i].q
    if (reduced) { setTyped(word); return }
    let n = 0
    setTyped('')
    timer.current = setInterval(() => {
      n += 1
      setTyped(word.slice(0, n))
      if (n >= word.length && timer.current) { clearInterval(timer.current); timer.current = null }
    }, 55)
  }
  const clear = () => { if (timer.current) clearInterval(timer.current); setQuery(null); setTyped('') }
  const showHits = query !== null && typed === queries[query].q
  const folder = folders[open]

  return (
    <div className={`${f.card} ${f.explorer}`}>
      <aside className={f.tree}>
        {folders.map((fo, i) => (
          <button key={fo.name} type="button" className={`${f.treeItem} ${open === i && query === null ? f.treeOn : ''}`} onClick={() => { clear(); setOpen(i) }}>
            {open === i && query === null ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />}
            <span>{fo.name}</span>
          </button>
        ))}
        <div className={f.quota}>
          <div className={f.quotaBar}><i style={{ width: '21%' }} /></div>
          {t('quota')}
        </div>
      </aside>
      <div className={f.pane}>
        <div className={f.searchBox}>
          <SearchIcon size={15} />
          <span className={typed ? f.searchText : f.searchPh}>{typed || t('search')}{query !== null && !showHits && <i className={f.caret} />}</span>
          {query !== null && <button type="button" className={f.searchClear} onClick={clear} aria-label="×"><XIcon size={14} /></button>}
        </div>
        <div className={f.tryRow}>
          {t('try')}
          {queries.map((q, i) => (
            <button key={q.q} type="button" className={`${f.chip} ${query === i ? f.chipOn : ''}`} onClick={() => search(i)}>{q.q}</button>
          ))}
        </div>
        {query === null ? (
          <div key={open} className={f.list}>
            <div className={f.access}><UsersIcon size={13} /> {folder.access}</div>
            {folder.files.map((file, i) => (
              <div key={file.name} className={f.fileRow} style={{ animationDelay: `${i * 0.06}s` }}>
                <FileIcon kind={file.kind} />
                <span className={f.fileName}>{file.name}</span>
                <span className={f.fileMeta}>{file.meta}</span>
              </div>
            ))}
          </div>
        ) : showHits ? (
          <div key={`q${query}`} className={f.list}>
            <div className={f.access}><SearchIcon size={13} /> {t('found')}</div>
            {queries[query].hits.map((h, i) => (
              <div key={h.file} className={`${f.fileRow} ${f.hit}`} style={{ animationDelay: `${i * 0.08}s` }}>
                <FileIcon kind={h.file.endsWith('.docx') ? 'docx' : 'pdf'} />
                <div className={f.hitBody}>
                  <span className={f.fileName}>{h.file}</span>
                  <span className={f.hitFolder}>{h.folder}</span>
                  <span className={f.snippet}><Marked text={h.snippet} /></span>
                </div>
              </div>
            ))}
          </div>
        ) : <div className={f.list} />}
      </div>
    </div>
  )
}

// ─── B: hand-in flow ─────────────────────────────────
const STEP_MS = 3600
function HandIn({ inView }: { inView: boolean }) {
  const t = useTranslations('filesPromo.b')
  const steps = t.raw('steps') as string[]
  const students = t.raw('students') as Student[]
  const work = t.raw('work') as string[]
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!inView || !auto || reduced) return
    const id = setInterval(() => setStep(n => (n + 1) % steps.length), STEP_MS)
    return () => clearInterval(id)
  }, [inView, auto, reduced, steps.length])
  const pick = (i: number) => { setAuto(false); setStep(i) }
  const STATUS = { ok: CheckIcon, late: ClockIcon, none: XIcon } as const

  return (
    <div className={`${f.card} ${f.handIn}`}>
      <div className={f.stepper} role="tablist">
        {steps.map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={step === i} className={`${f.step} ${step === i ? f.stepOn : ''} ${step > i ? f.stepDone : ''}`} onClick={() => pick(i)}>
            <b>{step > i ? <CheckIcon size={12} /> : i + 1}</b>
            <span>{label}</span>
            {step === i && auto && inView && !reduced && <i className={f.stepTimer} style={{ animationDuration: `${STEP_MS}ms` }} />}
          </button>
        ))}
      </div>
      <div key={step} className={f.stage}>
        {step === 0 && (
          <div className={f.folderCard}>
            <div className={f.folderHead}><FolderIcon size={22} /> <strong>{t('folder')}</strong></div>
            <div className={f.fileRow}><FileIcon kind="pdf" /><span className={f.fileName}>{t('task')}</span></div>
            <div className={f.badges}>
              <span className={f.badgeRed}><ClockIcon size={13} /> {t('deadline')}</span>
              <span className={f.badge}><CalendarDaysIcon size={13} /> {t('inCalendar')}</span>
            </div>
            <MiniMonth />
          </div>
        )}
        {step === 1 && (
          <div>
            <div className={f.access}><UsersIcon size={13} /> {t('summary')}</div>
            {students.map((st, i) => {
              const Icon = STATUS[st.status]
              return (
                <div key={st.name} className={f.fileRow} style={{ animationDelay: `${i * 0.1}s` }}>
                  <span className={f.avatar}>{st.name[0]}</span>
                  <span className={f.fileName}>{st.name}</span>
                  <span className={`${f.status} ${f[`s_${st.status}`]}`}><Icon size={12} /> {st.label}</span>
                </div>
              )
            })}
          </div>
        )}
        {step === 2 && (
          <div className={f.paper}>
            <div className={f.paperTitle}><FileTextIcon size={14} /> {t('workTitle')}</div>
            {/* ==…== in a line is the mistake — circled by the tutor's pen */}
            {work.map((line, i) => (
              <div key={i} className={f.hand}>
                {line.split(/(==.+?==)/).map((part, j) => part.startsWith('==') ? (
                  <span key={j} className={f.circled}>
                    {part.slice(2, -2)}
                    <svg className={f.pen} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
                      <path className={f.penStroke} pathLength={1} d="M52 3 C 82 1, 99 10, 97 21 C 95 33, 70 38, 46 37 C 18 36, 2 29, 4 18 C 6 8, 28 3, 60 5" />
                    </svg>
                  </span>
                ) : <Fragment key={j}>{part}</Fragment>)}
              </div>
            ))}
            <div className={f.remark}><PenLineIcon size={13} /> {t('remark')}</div>
            <span className={`${s.btn_red_sm} ${f.uploadBtn}`}><UploadIcon size={13} /> {t('upload')}</span>
          </div>
        )}
        {step === 3 && (
          <div>
            <div className={f.folderHead}><FolderOpenIcon size={20} /> <strong>{t('folder')} / {students[2].name}</strong></div>
            <div className={f.fileRow}><FileIcon kind="img" /><span className={f.fileName}>{t('workTitle')}</span></div>
            <div className={`${f.fileRow} ${f.fresh}`}>
              <FileIcon kind="pdf" />
              <div className={f.hitBody}><span className={f.fileName}>{t('returned')}</span><span className={f.hitFolder}>{t('returnedMeta')}</span></div>
            </div>
            <div className={f.toast}><EyeIcon size={14} /> {t('seen')}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/** A month strip with the deadline on it — the folder shows up in the calendar by itself. */
function MiniMonth() {
  return (
    <div className={f.month} aria-hidden>
      {Array.from({ length: 14 }, (_, i) => {
        const day = i + 1
        return <span key={i} className={day === 12 ? f.dayDeadline : ''}>{day}{day === 12 && <i />}</span>
      })}
    </div>
  )
}

// ─── C: two sides ────────────────────────────────────
function TwoSides() {
  const t = useTranslations('filesPromo.c')
  const [side, setSide] = useState<'tutor' | 'student'>('tutor')
  const rows = (k: string) => t.raw(k) as Row[]
  return (
    <div className={`${f.card} ${f.sides}`}>
      <div className={f.toggle} role="tablist">
        <button type="button" role="tab" aria-selected={side === 'tutor'} className={side === 'tutor' ? f.toggleOn : ''} onClick={() => setSide('tutor')}><GraduationCapIcon size={15} /> {t('tutor')}</button>
        <button type="button" role="tab" aria-selected={side === 'student'} className={side === 'student' ? f.toggleOn : ''} onClick={() => setSide('student')}><UserIcon size={15} /> {t('student')}</button>
      </div>
      {side === 'tutor' ? (
        <div key="tutor" className={f.list}>
          <div className={f.sideTitle}>{t('tutorTitle')}</div>
          {rows('tutorRows').map((r, i) => <FolderRow key={r.name} r={r} i={i} />)}
          <div className={f.quota}><div className={f.quotaBar}><i style={{ width: '21%' }} /></div>{t('quota')}</div>
        </div>
      ) : (
        <div key="student" className={f.list}>
          <div className={f.sideTitle}>{t('studentTitle')}</div>
          {rows('studentRows').map((r, i) => <FolderRow key={r.name} r={r} i={i} />)}
          <div className={f.sideTitle} style={{ marginTop: 16 }}>{t('mineTitle')}</div>
          {rows('mineRows').map((r, i) => <FolderRow key={r.name} r={r} i={i + 2} />)}
        </div>
      )}
    </div>
  )
}

function FolderRow({ r, i }: { r: Row; i: number }) {
  return (
    <div className={f.fileRow} style={{ animationDelay: `${i * 0.06}s` }}>
      <span className={`${f.fileIcon} ${f.k_folder}`}><FolderIcon size={16} /></span>
      <div className={f.hitBody}><span className={f.fileName}>{r.name}</span><span className={f.hitFolder}>{r.meta}</span></div>
    </div>
  )
}

export function FilesPromo() {
  const t = useTranslations('filesPromo')
  const [variant, setVariant] = useState<Variant>('a')
  const [ref, inView] = useInView<HTMLElement>()
  return (
    <section ref={ref} className={f.wrap} aria-labelledby="files-promo-title">
      <div className={f.switcher} role="group" aria-label={t('variant')}>
        <span>{t('variant')}</span>
        {(['a', 'b', 'c'] as const).map(v => (
          <button key={v} type="button" aria-pressed={variant === v} className={variant === v ? f.switchOn : ''} onClick={() => setVariant(v)}>{v.toUpperCase()}</button>
        ))}
      </div>
      <div className={s.section_grid}>
        <Copy v={variant} />
        {variant === 'a' && <Explorer />}
        {variant === 'b' && <HandIn inView={inView} />}
        {variant === 'c' && <TwoSides />}
      </div>
    </section>
  )
}

