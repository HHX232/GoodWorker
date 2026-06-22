'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'

// ── CSS variables & global styles ─────────────────────────────
const CSS = `
  :root {
    --bg: #f4f3f0; --paper: #ffffff; --paper-2: #f7f6f3;
    --ink: #0c0c0d; --ink-2: #5a5a5e; --ink-3: #9d9d9f;
    --line: #e3e2dd; --radius: 0px;
    --mono: "JetBrains Mono", ui-monospace, monospace;
    --btn-fg: #ffffff; --btn-fg-mid: rgba(255,255,255,0.65); --btn-fg-dim: rgba(255,255,255,0.5);
  }
  html.theme-dark, html.pomodoro-dark {
    --bg: #0e0e10; --paper: #171719; --paper-2: #1d1d20;
    --ink: #e0e0de; --ink-2: #808079; --ink-3: #4c4c49;
    --line: #2a2a2e; --btn-fg: #0e0e10; --btn-fg-mid: rgba(14,14,16,0.65); --btn-fg-dim: rgba(14,14,16,0.5);
  }
  .tt-cta-wrap { background: #0c0c0d !important; color: #ffffff; }
  html.theme-dark .tt-cta-wrap, html.pomodoro-dark .tt-cta-wrap { background: #17171a !important; }
  .tt-grid {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: linear-gradient(to right, rgba(12,12,13,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,12,13,0.035) 1px, transparent 1px);
    background-size: 64px 64px;
  }
  html.theme-dark .tt-grid, html.pomodoro-dark .tt-grid {
    background-image: linear-gradient(to right, rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px);
  }
  @keyframes tt-caret { 0%,50%{opacity:1}50.01%,100%{opacity:0} }
  @keyframes tt-logIn { from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none} }
  @media(max-width:640px){.tt-navlinks{display:none!important}}
`

const MAXW = 1200

// ── Primitives ────────────────────────────────────────────────
function CornerTicks({ size = 9, color = 'var(--ink)', inset = -1 }: { size?: number; color?: string; inset?: number }) {
  const v = `${size}px`
  const base: React.CSSProperties = { position: 'absolute', width: v, height: v, pointerEvents: 'none' }
  return (
    <>
      <span style={{ ...base, top: inset, left: inset, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` }} />
      <span style={{ ...base, top: inset, right: inset, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` }} />
      <span style={{ ...base, bottom: inset, left: inset, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` }} />
      <span style={{ ...base, bottom: inset, right: inset, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` }} />
    </>
  )
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <span style={{ width: 22, height: 1, background: 'var(--ink)', display: 'inline-block' }} />
      {children}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--ink)', color: 'var(--btn-fg)', border: '1.5px solid var(--ink)', padding: '11px 18px', borderRadius: 'var(--radius)' }
const btnGhost: React.CSSProperties = { fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'var(--ink)', border: '1.5px solid var(--line)', padding: '11px 18px', borderRadius: 'var(--radius)' }

// ── Nav ───────────────────────────────────────────────────────
function Nav() {
  const t = useTranslations('PdfInfoPage')
  const links = [t('nav_how'), t('nav_types'), t('nav_demo'), t('nav_faq')]
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>GoodWorker</Link>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink-2)', textTransform: 'uppercase' }}>{t('nav_subtitle')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div className="tt-navlinks" style={{ display: 'flex', gap: 26 }}>
          {links.map(l => (
            <span key={l} style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.04em', color: 'var(--ink-2)', cursor: 'pointer' }}>{l}</span>
          ))}
        </div>
        <Link href="/profile" style={{ ...btnPrimary, textDecoration: 'none', fontSize: 13, display: 'inline-block' }}>{t('nav_upload')}</Link>
      </div>
    </nav>
  )
}

// ── TrustRow ──────────────────────────────────────────────────
function TrustRow() {
  const t = useTranslations('PdfInfoPage')
  const items = [t('trust_1'), t('trust_2'), t('trust_3'), t('trust_4')]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('trust_label')}</span>
      {items.map((it, i) => (
        <span key={it} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {i > 0 && <span style={{ width: 3, height: 3, background: 'var(--ink-3)', borderRadius: '50%', display: 'inline-block' }} />}
          <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{it}</span>
        </span>
      ))}
    </div>
  )
}

// ── FauxPage (PDF scan simulation) ───────────────────────────
function FauxPage({ progress }: { progress: number }) {
  const rows = [
    { w: '55%', h: 9, head: true }, { w: '92%' }, { w: '88%' }, { w: '70%' },
    { w: '40%', q: true }, { w: '84%' }, { w: '78%' },
    { w: '46%', q: true }, { w: '90%' }, { w: '64%' }, { w: '30%' },
  ]
  return (
    <div style={{ position: 'relative', background: 'var(--paper)', border: '1px solid var(--line)', padding: '18px 18px 22px', height: '100%', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {rows.map((r, i) => {
          const pos = ((i + 0.5) / rows.length) * 100
          const scanned = pos <= progress
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {r.q && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: scanned ? 'var(--ink)' : 'var(--ink-3)', width: 16, transition: 'color .3s' }}>{`Q${i < 5 ? 1 : 2}`}</span>}
              <span style={{ height: r.head ? 9 : 6, width: r.w, borderRadius: 1, background: scanned ? (r.head ? 'var(--ink)' : 'var(--ink-2)') : 'var(--line)', transition: 'background .3s', display: 'block' }} />
            </div>
          )
        })}
      </div>
      {progress > 0 && progress < 100 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${progress}%`, height: 2, background: 'var(--ink)' }}>
          <span style={{ position: 'absolute', right: 6, top: -16, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink)' }}>SCAN</span>
        </div>
      )}
    </div>
  )
}

// ── SingleChoice ──────────────────────────────────────────────
function SingleChoice({ question, options, correct }: { question?: string; options: string[]; correct: number }) {
  const t = useTranslations('PdfInfoPage')
  const [sel, setSel] = useState<number | null>(null)
  return (
    <div>
      {question && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--ink)', lineHeight: 1.4 }}>{question}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((o, i) => {
          const on = sel === i
          const isCorrect = correct === i
          const showState = sel !== null && (on || isCorrect)
          return (
            <button key={i} type="button" onClick={() => setSel(i)} style={{
              display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer',
              border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'var(--paper)',
              color: on ? 'var(--btn-fg)' : 'var(--ink)', padding: '11px 13px', borderRadius: 'var(--radius)',
              font: 'inherit', fontSize: 14, transition: 'border-color .12s, background .12s',
            }}>
              <span style={{ width: 18, height: 18, flexShrink: 0, border: `1.5px solid ${on ? 'var(--btn-fg)' : 'var(--ink-3)'}`, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 10 }}>
                {on ? '✓' : String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{o}</span>
              {showState && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', opacity: 0.8 }}>{isCorrect ? t('sc_correct') : (on ? t('sc_wrong') : '')}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Question types from API ───────────────────────────────────
type PQ =
  | { type: 'single'; question: string; options: string[]; correct: number }
  | { type: 'multi';  question: string; options: string[]; correct: number[] }
  | { type: 'match';  question?: string; pairs: [string, string][] }
  | { type: 'fill';   question: string; answer: string }
  | { type: 'bool';   statement: string; correct: boolean }
  | { type: 'order';  question?: string; items: string[] }

interface TestResult {
  title: string
  questions: PQ[]
  pageCount: number
  ocr: boolean
  isGuest: boolean
  guestLimit: number | null
  totalChars: number
}

// inline preview for question types other than single-choice
function QuestionPreview({ q, idx, total }: { q: PQ; idx: number; total: number }) {
  const t = useTranslations('PdfInfoPage')
  const label = { single: t('qtype_single'), multi: t('qtype_multi'), match: t('qtype_match'), fill: t('qtype_fill'), bool: t('qtype_bool'), order: t('qtype_order') }[q.type]
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, background: 'var(--paper-2)', marginBottom: 0 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 10 }}>{t('done_q_num', { idx: idx + 1, total, label })}</div>
      {q.type === 'single' && (
        <SingleChoice question={q.question} options={q.options} correct={q.correct} />
      )}
      {q.type === 'multi' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{q.question}</div>
          <MultiChoice options={q.options} />
        </div>
      )}
      {q.type === 'bool' && (
        <div>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, marginBottom: 12 }}>{q.statement}</div>
          <TrueFalseQ />
        </div>
      )}
      {q.type === 'fill' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{q.question}</div>
          <FillIn answer={q.answer} placeholder={t('fill_placeholder')} question={q.question} />
        </div>
      )}
      {q.type === 'match' && (
        <div>
          {q.question && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{q.question}</div>}
          <MatchPairs left={q.pairs.map(p => p[0])} right={q.pairs.map(p => p[1])} />
        </div>
      )}
      {q.type === 'order' && (
        <div>
          {q.question && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{q.question}</div>}
          <OrderingQ items={q.items} />
        </div>
      )}
    </div>
  )
}

// ── DropDemo ──────────────────────────────────────────────────
function DropDemo({ wide = false }: { wide?: boolean }) {
  const t = useTranslations('PdfInfoPage')
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user

  const [state, setState] = useState<'idle' | 'drag' | 'processing' | 'done' | 'error' | 'vip'>('idle')
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<TestResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [previewIdx, setPreviewIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])
  const rafRef = useRef<number>(0)
  const dragDepth = useRef(0)
  const startRef = useRef(0)

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    cancelAnimationFrame(rafRef.current)
  }, [])
  useEffect(() => () => clearAll(), [clearAll])

  const addLog = (msg: string) => setLog(l => [...l, msg])

  const begin = useCallback(async (file: File) => {
    clearAll()
    setState('processing')
    setFileName(file.name)
    setLog([])
    setProgress(0)
    setResult(null)
    setErrorMsg('')
    setPreviewIdx(0)

    // Animated progress (independent from actual request timing)
    startRef.current = performance.now()
    const ESTIMATED_MS = 18000 // ~18s estimate; jumps to 100 on real response
    const animFrame = () => {
      const elapsed = performance.now() - startRef.current
      // Eased progress: fast at first, slows down → max 92% until response
      const t = Math.min(elapsed / ESTIMATED_MS, 1)
      const eased = 1 - Math.pow(1 - t, 2.2)
      setProgress(Math.round(eased * 92))
      rafRef.current = requestAnimationFrame(animFrame)
    }
    rafRef.current = requestAnimationFrame(animFrame)

    // Scripted log messages at realistic timings
    const LOG: [number, string][] = [
      [300,  t('proc_log1')],
      [900,  t('proc_log2')],
      [2200, t('proc_log3')],
      [4500, t('proc_log4')],
      [7000, t('proc_log5')],
      [10000, t('proc_log6')],
      [14000, t('proc_log7')],
    ]
    LOG.forEach(([t, msg]) => {
      timers.current.push(window.setTimeout(() => addLog(msg), t))
    })

    // Real upload
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/pdf-to-test', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        clearAll()
        if (data.vipRequired) { setState('vip'); return }
        throw new Error(data.error ?? `Ошибка ${res.status}`)
      }

      clearAll()
      setProgress(100)
      addLog(t('proc_done', { count: (data as TestResult).questions.length }))
      setResult(data as TestResult)
      timers.current.push(window.setTimeout(() => setState('done'), 500))
    } catch (e) {
      clearAll()
      setErrorMsg((e as Error).message)
      setState('error')
    }
  }, [clearAll])

  const reset = () => { clearAll(); setState('idle'); setProgress(0); setLog([]); setFileName(''); setResult(null); setErrorMsg('') }

  const onFiles = useCallback((files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    begin(f)
  }, [begin])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); dragDepth.current = 0
    if (state === 'processing') return
    onFiles(e.dataTransfer.files)
  }
  const onDragOver = (e: React.DragEvent) => e.preventDefault()
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragDepth.current += 1; if (state !== 'processing') setState('drag') }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0 && state === 'drag') setState('idle') }

  const panelH = wide ? 380 : 420

  // ── DONE ─────────────────────────────────────────────────────
  if (state === 'done' && result) {
    const qs = result.questions
    const q = qs[previewIdx]
    const typeCount: Record<string, number> = {}
    qs.forEach(qq => { typeCount[qq.type] = (typeCount[qq.type] ?? 0) + 1 })
    const typeTags = Object.entries(typeCount).map(([tp, n]) => {
      const labels: Record<string, string> = { single: t('type_single'), multi: t('type_multi'), match: t('type_match'), fill: t('type_fill'), bool: t('type_bool'), order: t('type_order') }
      return `${labels[tp] ?? tp} ×${n}`
    })
    return (
      <div style={{ position: 'relative', border: '1.5px solid var(--ink)', background: 'var(--paper)', borderRadius: 'var(--radius)', padding: 24 }}>
        <CornerTicks />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 24, height: 24, borderRadius: 'var(--radius)', background: 'var(--ink)', color: 'var(--btn-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>✓</span>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{result.title}</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            {result.ocr ? t('done_meta_ocr', { count: qs.length, pages: result.pageCount }) : t('done_meta', { count: qs.length, pages: result.pageCount })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {typeTags.map(t => (
            <span key={t} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', padding: '3px 8px', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>{t}</span>
          ))}
        </div>

        {/* Question preview + navigation */}
        {q && <QuestionPreview q={q} idx={previewIdx} total={qs.length} />}
        {qs.length > 1 && (
          <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
            {qs.map((_, i) => (
              <button key={i} type="button" onClick={() => setPreviewIdx(i)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', border: `1px solid ${i === previewIdx ? 'var(--ink)' : 'var(--line)'}`, background: i === previewIdx ? 'var(--ink)' : 'var(--paper)', color: i === previewIdx ? 'var(--btn-fg)' : 'var(--ink-3)', borderRadius: 'var(--radius)' }}>{i + 1}</button>
            ))}
          </div>
        )}

        {/* Guest notice */}
        {result.isGuest && (
          <div style={{ marginTop: 16, padding: '10px 14px', border: '1px dashed var(--line)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {t('done_guest', { n: result.guestLimit ?? 0 })}{' '}
            <Link href="/auth/register" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>{t('done_register')}</Link>{' '}
            {t('done_register_sfx')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          {isLoggedIn
            ? <Link href="/profile" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>{t('done_save')}</Link>
            : <Link href="/auth/register" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>{t('done_login_save')}</Link>
          }
          <button type="button" onClick={reset} style={btnGhost}>{t('done_another')}</button>
        </div>
      </div>
    )
  }

  // ── VIP REQUIRED ──────────────────────────────────────────────
  if (state === 'vip') return (
    <div style={{ position: 'relative', border: '1.5px solid var(--ink)', background: 'var(--paper)', borderRadius: 'var(--radius)', padding: 24 }}>
      <CornerTicks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 24, height: 24, borderRadius: 'var(--radius)', background: 'var(--ink)', color: 'var(--btn-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>★</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{t('vip_title')}</span>
      </div>
      <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 8 }}>
        {t('vip_p1a')}<strong style={{ color: 'var(--ink)' }}>{t('vip_p1b')}</strong>{t('vip_p1c')}
      </p>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>
        {t('vip_p2')}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/profile" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>{t('vip_btn')}</Link>
        <button type="button" onClick={reset} style={btnGhost}>{t('vip_btn2')}</button>
      </div>
    </div>
  )

  // ── ERROR ─────────────────────────────────────────────────────
  if (state === 'error') return (
    <div style={{ position: 'relative', border: '1.5px solid var(--ink)', background: 'var(--paper)', borderRadius: 'var(--radius)', padding: 24 }}>
      <CornerTicks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 24, height: 24, borderRadius: 'var(--radius)', background: 'var(--ink)', color: 'var(--btn-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>✗</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{t('err_title')}</span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>{errorMsg}</p>
      <button type="button" onClick={reset} style={btnPrimary}>{t('err_retry')}</button>
    </div>
  )

  // ── PROCESSING ────────────────────────────────────────────────
  if (state === 'processing') return (
    <div style={{ position: 'relative', border: '1.5px solid var(--ink)', background: 'var(--paper)', borderRadius: 'var(--radius)', padding: 22 }}>
      <CornerTicks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>📄 {fileName}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{Math.round(progress)}%</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, marginBottom: 14 }}>
        <div style={{ height: panelH - 120 }}><FauxPage progress={progress} /></div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8, color: 'var(--ink-2)' }}>
          {log.map((l, i) => (
            <div key={i} style={{ color: l.startsWith('✓') ? 'var(--ink)' : 'var(--ink-2)', fontWeight: l.startsWith('✓') ? 600 : 400, animation: 'tt-logIn .25s ease both' }}>{l}</div>
          ))}
          <span style={{ display: 'inline-block', width: 7, height: 14, background: 'var(--ink)', animation: 'tt-caret 1s steps(1) infinite', verticalAlign: 'middle' }} />
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--ink)', transition: 'width .25s ease' }} />
      </div>
      {!isLoggedIn && (
        <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
          {t('proc_guest')}
        </div>
      )}
    </div>
  )

  // ── IDLE / DRAG ───────────────────────────────────────────────
  const active = state === 'drag'
  return (
    <div onDrop={onDrop} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      style={{
        position: 'relative', cursor: 'pointer', height: panelH,
        border: `1.5px dashed ${active ? 'var(--ink)' : 'var(--ink-3)'}`,
        background: active ? 'var(--ink)' : 'var(--paper-2)',
        color: active ? 'var(--btn-fg)' : 'var(--ink)',
        borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
        transition: 'background .15s, border-color .15s, color .15s', userSelect: 'none',
      }}>
      <input ref={inputRef} type="file"
        accept={isLoggedIn
          ? 'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,application/rtf,text/rtf,.rtf,application/vnd.oasis.opendocument.text,.odt'
          : 'application/pdf,.pdf'}
        style={{ display: 'none' }}
        onChange={e => onFiles(e.target.files)} onClick={e => e.stopPropagation()} />
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--btn-fg)' : 'var(--ink)'} strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" style={{ transform: active ? 'translateY(-2px)' : 'none', transition: 'transform .15s' }}>
        <path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M3 14v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6" />
      </svg>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 16, letterSpacing: '-0.01em' }}>{active ? t('drop_drag') : t('drop_title')}</div>
      <div style={{ fontSize: 14, color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-2)', marginTop: 6 }}>{t('drop_sub')}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 20 }} onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => inputRef.current?.click()} style={{ ...btnPrimary, ...(active ? { background: 'var(--bg)', color: 'var(--ink)' } : {}) }}>{t('drop_btn')}</button>
      </div>
      {!isLoggedIn && (
        <div style={{ marginTop: 16, fontSize: 12.5, color: active ? 'var(--btn-fg-mid)' : 'var(--ink-3)', lineHeight: 1.45, maxWidth: 320 }}>
          {t('drop_guest')}{' '}
          <Link href="/auth/register" onClick={e => e.stopPropagation()} style={{ color: active ? 'var(--btn-fg)' : 'var(--ink-2)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{t('drop_login')}</Link>
          {' '}{t('drop_login_sfx')}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: active ? 'var(--btn-fg-dim)' : 'var(--ink-3)', textAlign: 'center' }}>
        {isLoggedIn ? t('drop_fmt_vip') : t('drop_fmt_guest')}
      </div>
    </div>
  )
}

// ── Hero (variant B — centred) ────────────────────────────────
function Hero() {
  const t = useTranslations('PdfInfoPage')
  return (
    <section style={{ padding: '64px 0 80px', textAlign: 'center' }}>
      <Eyebrow style={{ justifyContent: 'center', marginBottom: 24 }}>{t('hero_badge')}</Eyebrow>
      <h1 style={{ fontSize: 'clamp(36px, 7vw, 66px)', lineHeight: 1.0, fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto', maxWidth: 880, color: 'var(--ink)' }}>
        {t('hero_h1')}<br />{t('hero_h1b')}
      </h1>
      <p style={{ fontSize: 'clamp(15px, 2.4vw, 18px)', lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 600, margin: '22px auto 0' }}>
        {t('hero_desc')}
      </p>
      <div style={{ maxWidth: 720, margin: '40px auto 0', textAlign: 'left' }}>
        <DropDemo wide />
      </div>
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}><TrustRow /></div>
    </section>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ num, label, title, desc, children, divider = true, style }: {
  num?: string; label: string; title?: string; desc?: string; children?: React.ReactNode; divider?: boolean; style?: React.CSSProperties
}) {
  return (
    <section style={{ padding: '76px 0', borderTop: divider ? '1px solid var(--line)' : 'none', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 20 }}>
        <Eyebrow>{label}</Eyebrow>
        {num && <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{num}</span>}
      </div>
      {title && <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0, maxWidth: 760 }}>{title}</h2>}
      {desc && <p style={{ fontSize: 16.5, lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 580, marginTop: 16 }}>{desc}</p>}
      <div style={{ marginTop: 40 }}>{children}</div>
    </section>
  )
}

// ── StepGlyph ─────────────────────────────────────────────────
function StepGlyph({ kind }: { kind: string }) {
  const c = 'var(--ink)'
  if (kind === 'doc') return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="8" y="5" width="18" height="24" />
      <line x1="11" y1="11" x2="23" y2="11" /><line x1="11" y1="15" x2="23" y2="15" />
      <line x1="11" y1="19" x2="20" y2="19" /><line x1="11" y1="23" x2="22" y2="23" />
    </svg>
  )
  if (kind === 'scan') return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="7" y="7" width="20" height="20" />
      <line x1="7" y1="17" x2="27" y2="17" strokeWidth="2" />
      <line x1="11" y1="12" x2="20" y2="12" /><line x1="11" y1="22" x2="23" y2="22" />
    </svg>
  )
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="6" y="8" width="22" height="16" /><line x1="14" y1="27" x2="20" y2="27" />
      <path d="M11 16l3 3 6-7" strokeWidth="1.8" />
    </svg>
  )
}

// ── HowItWorks ────────────────────────────────────────────────
function HowItWorks() {
  const t = useTranslations('PdfInfoPage')
  const steps = [
    { n: '01', title: t('how_s1t'), d: t('how_s1d'), glyph: 'doc' },
    { n: '02', title: t('how_s2t'), d: t('how_s2d'), glyph: 'scan' },
    { n: '03', title: t('how_s3t'), d: t('how_s3d'), glyph: 'screen' },
  ]
  return (
    <Section num={t('how_num')} label={t('how_badge')} title={t('how_h2')} desc={t('how_desc')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ padding: 28, borderLeft: i ? '1px solid var(--line)' : 'none', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--ink)' }}>{s.n}</span>
              <StepGlyph kind={s.glyph} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{s.title}</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)', marginTop: 10, marginBottom: 0 }}>{s.d}</p>
            {i < 2 && (
              <span style={{
                position: 'absolute', right: -9, top: '50%', transform: 'translateY(-50%)', zIndex: 1,
                width: 18, height: 18, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)',
              }}>→</span>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Question type cards ───────────────────────────────────────
function QTCard({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 22, background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', border: '1px solid var(--line)', padding: '3px 6px', borderRadius: 'var(--radius)' }}>{tag}</span>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function MultiChoice({ options }: { options: string[] }) {
  const [sel, setSel] = useState([1])
  const toggle = (i: number) => setSel(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {options.map((o, i) => {
        const on = sel.includes(i)
        return (
          <button key={i} type="button" onClick={() => toggle(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', font: 'inherit', fontSize: 13.5, border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--paper)', color: 'var(--ink)', padding: '9px 11px', borderRadius: 'var(--radius)' }}>
            <span style={{ width: 16, height: 16, flexShrink: 0, border: `1.5px solid ${on ? 'var(--ink)' : 'var(--ink-3)'}`, background: on ? 'var(--ink)' : 'var(--paper)', color: 'var(--btn-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{on ? '✓' : ''}</span>
            {o}
          </button>
        )
      })}
    </div>
  )
}

function MatchPairs({ left, right }: { left: string[]; right: string[] }) {
  const t = useTranslations('PdfInfoPage')
  const [val, setVal] = useState(left.map(() => ''))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {left.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--paper-2)' }}>{l}</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontSize: 13 }}>→</span>
          <select value={val[i]} onChange={e => setVal(v => v.map((x, j) => j === i ? e.target.value : x))} style={{ flex: 1, font: 'inherit', fontSize: 13.5, padding: '8px', border: `1px solid ${val[i] ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 'var(--radius)', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
            <option value="">{t('match_select')}</option>
            {right.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

function FillIn({ answer, placeholder, question }: { answer: string; placeholder: string; question?: string }) {
  const t = useTranslations('PdfInfoPage')
  const [v, setV] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'wrong'>('idle')
  const [hint, setHint] = useState<string | null>(null)

  const check = async () => {
    if (!v.trim()) return
    setStatus('loading')
    setHint(null)
    try {
      const res = await fetch('/api/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAnswer: v, correctAnswer: answer, question }),
      })
      const data = await res.json()
      setStatus(data.ok ? 'ok' : 'wrong')
      setHint(data.hint ?? null)
    } catch {
      // Fallback to local match
      const ok = v.trim().toLowerCase() === answer.trim().toLowerCase()
      setStatus(ok ? 'ok' : 'wrong')
    }
  }

  const borderColor = status === 'ok' ? 'var(--ink)' : status === 'wrong' ? 'var(--ink-3)' : 'var(--line)'
  const statusText =
    status === 'loading' ? '…' :
    status === 'ok'      ? t('fill_ok') :
    status === 'wrong'   ? `✗ ${hint ?? t('fill_try')}` :
    t('fill_idle')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={v}
          placeholder={placeholder}
          onChange={e => { setV(e.target.value); setStatus('idle'); setHint(null) }}
          onKeyDown={e => e.key === 'Enter' && check()}
          style={{ flex: 1, font: 'inherit', fontSize: 14, padding: '10px 12px', border: `1px solid ${borderColor}`, borderRadius: 'var(--radius)', outline: 'none', background: 'var(--paper)', color: 'var(--ink)', transition: 'border-color .15s' }}
        />
        <button type="button" onClick={check} disabled={status === 'loading'} style={{ ...btnPrimary, padding: '10px 14px', fontSize: 13, opacity: status === 'loading' ? 0.6 : 1 }}>
          {status === 'loading' ? '…' : 'OK'}
        </button>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 9, color: status === 'ok' ? 'var(--ink)' : status === 'wrong' ? 'var(--ink-3)' : 'var(--ink-2)', minHeight: 14, transition: 'color .15s' }}>
        {statusText}
      </div>
    </div>
  )
}

function OrderingQ({ items: init }: { items: string[] }) {
  const [items, setItems] = useState(init)
  const move = (i: number, d: number) => setItems(arr => {
    const j = i + d; if (j < 0 || j >= arr.length) return arr
    const next = arr.slice();[next[i], next[j]] = [next[j], next[i]]; return next
  })
  const ordBtn: React.CSSProperties = { font: 'inherit', fontSize: 9, lineHeight: 1, cursor: 'pointer', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', width: 20, height: 13, color: 'var(--ink-2)', padding: 0 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((it, i) => (
        <div key={it} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--paper)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', width: 14 }}>{i + 1}</span>
          <span style={{ fontSize: 13.5, flex: 1 }}>{it}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button type="button" onClick={() => move(i, -1)} style={ordBtn}>▲</button>
            <button type="button" onClick={() => move(i, 1)} style={ordBtn}>▼</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TrueFalseQ() {
  const t = useTranslations('PdfInfoPage')
  const [v, setV] = useState<boolean | null>(null)
  return (
    <div>
      <div style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 14, color: 'var(--ink)' }}>{t('tf_stmt')}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[[t('tf_true'), true], [t('tf_false'), false]].map(([lbl, val]) => {
          const on = v === val
          return (
            <button key={String(lbl)} type="button" onClick={() => setV(val as boolean)} style={{ flex: 1, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '11px 0', border: `1.5px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'var(--paper)', color: on ? 'var(--btn-fg)' : 'var(--ink)', borderRadius: 'var(--radius)' }}>{lbl}</button>
          )
        })}
      </div>
    </div>
  )
}

function QuestionTypes() {
  const t = useTranslations('PdfInfoPage')
  return (
    <Section num={t('qt_num')} label={t('qt_badge')} title={t('qt_h2')} desc={t('qt_desc')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
        <QTCard tag="SINGLE" title={t('qt_c1_title')}>
          <SingleChoice options={[t('sc_opt1'), t('sc_opt2'), t('sc_opt3'), t('sc_opt4')]} correct={0} />
        </QTCard>
        <QTCard tag="MULTI" title={t('qt_c2_title')}>
          <MultiChoice options={['HTTP', 'TCP', 'SMTP', 'IP']} />
        </QTCard>
        <QTCard tag="MATCH" title={t('qt_c3_title')}>
          <MatchPairs left={['HTML', 'CSS', 'JS']} right={[t('match_r1'), t('match_r2'), t('match_r3')]} />
        </QTCard>
        <QTCard tag="INPUT" title={t('qt_c4_title')}>
          <FillIn answer="16" placeholder={t('fill_placeholder')} question="2⁴ = ?" />
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{t('qt_c4_hint')}</div>
        </QTCard>
        <QTCard tag="ORDER" title={t('qt_c5_title')}>
          <OrderingQ items={[t('order_1'), t('order_2'), t('order_3'), t('order_4')]} />
        </QTCard>
        <QTCard tag="BOOL" title={t('qt_c6_title')}>
          <TrueFalseQ />
        </QTCard>
      </div>
    </Section>
  )
}

// ── ResultShowcase ────────────────────────────────────────────
function ResultShowcase() {
  const t = useTranslations('PdfInfoPage')
  const grid = Array.from({ length: 12 }, (_, i) => i + 1)
  const cur = 3
  return (
    <Section num={t('rs_num')} label={t('rs_badge')} title={t('rs_h2')} desc={t('rs_desc')}>
      <div style={{ border: '1.5px solid var(--ink)', borderRadius: 'var(--radius)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 9, border: '1px solid var(--ink-3)', borderRadius: 'var(--radius)', display: 'inline-block' }} />)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '0.04em' }}>{t('rs_test_name')}</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>⏱ 14:32</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
          <div style={{ padding: 32, borderRight: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>{`${t('done_q_num', { idx: cur, total: 12, label: t('rs_q_type') })}`}</span>
              <div style={{ height: 4, width: 160, background: 'var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(cur / 12) * 100}%`, background: 'var(--ink)' }} />
              </div>
            </div>
            <SingleChoice question={t('rs_q')} options={[t('rs_o1'), t('rs_o2'), t('rs_o3'), t('rs_o4')]} correct={1} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button type="button" style={{ ...btnGhost, fontSize: 14 }}>{t('rs_prev')}</button>
              <button type="button" style={{ ...btnPrimary, fontSize: 14 }}>{t('rs_next')}</button>
            </div>
          </div>
          <div style={{ padding: 24, background: 'var(--paper-2)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 14 }}>{t('rs_q_list')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
              {grid.map(n => {
                const done = n < cur, active = n === cur
                return (
                  <span key={n} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13, borderRadius: 'var(--radius)', border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`, background: active ? 'var(--ink)' : done ? 'var(--ink)' : 'var(--paper)', color: (active || done) ? 'var(--btn-fg)' : 'var(--ink-3)', opacity: done && !active ? 0.55 : 1 }}>
                    {done ? '✓' : n}
                  </span>
                )
              })}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)' }}>{t('rs_answered')}</span><span style={{ fontFamily: 'var(--mono)' }}>2 / 12</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)' }}>{t('rs_left')}</span><span style={{ fontFamily: 'var(--mono)' }}>10</span></div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── 3D Scene (Three.js particle morph) ───────────────────────
const Scene3DClient = dynamic(() => import('./Scene3D'), { ssr: false, loading: () => <div style={{ height: 440 }} /> })

// ── StructureSection ──────────────────────────────────────────
function StructureSection() {
  const t = useTranslations('PdfInfoPage')
  const facts = [[t('st_f1n'), t('st_f1l')], [t('st_f2n'), t('st_f2l')], [t('st_f3n'), t('st_f3l')]]
  const stageNames = ['UPLOAD', 'LOADING', 'DOC', 'TEST']
  const [stage, setStage] = useState(0)
  return (
    <Section num={t('st_num')} label={t('st_badge')} title={t('st_h2')} desc={t('st_desc')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 40, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
            {[['↑', t('st_s1'), t('st_s1d')], ['◐', t('st_s2'), t('st_s2d')], ['▦', t('st_s3'), t('st_s3d')], ['✓', t('st_s4'), t('st_s4d')]].map(([k, st, d], i) => {
              const on = stage === i
              return (
                <div key={st} style={{ padding: '18px 20px', borderTop: i ? '1px solid var(--line)' : 'none', display: 'flex', gap: 14, alignItems: 'baseline', background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--btn-fg)' : 'inherit', transition: 'background .35s, color .35s', cursor: 'pointer' }} onClick={() => setStage(i)}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: on ? 'var(--btn-fg)' : 'var(--ink-3)', width: 24, textAlign: 'center' }}>{k}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{st}</div>
                    <div style={{ fontSize: 14, color: on ? 'var(--btn-fg-mid)' : 'var(--ink-2)', marginTop: 3 }}>{d}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 26, marginTop: 24 }}>
            {facts.map(([n, l]) => (
              <div key={l}>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--mono)' }}>{n}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--paper-2)' }}>
          <CornerTicks />
          <div style={{ position: 'absolute', top: 14, left: 16, zIndex: 2, display: 'flex', gap: 8, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em' }}>
            {stageNames.map((s, i) => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span style={{ color: 'var(--ink-3)' }}>→</span>}
                <span style={{ color: stage === i ? 'var(--ink)' : 'var(--ink-3)', fontWeight: stage === i ? 600 : 400 }}>{s}</span>
              </span>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: 14, left: 16, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-3)', zIndex: 2 }}>
            {['UPLOAD_FILE', 'RECOGNIZE', 'PARSE_DOC', 'BUILD_TEST'][stage]}
          </div>
          <Scene3DClient height={440} onStage={setStage} />
        </div>
      </div>
    </Section>
  )
}

// ── ErrorProfileSection ───────────────────────────────────────
function ErrorProfileSection() {
  const t = useTranslations('PdfInfoPage')
  const topics: [string, number, number, boolean][] = [
    [t('ep_topic1'), 0.72, 9, true], [t('ep_topic2'), 0.45, 6, false],
    [t('ep_topic3'), 0.3, 4, false], [t('ep_topic4'), 0.88, 11, true],
  ]
  const bullets = [
    [t('ep_b1t'), t('ep_b1d')],
    [t('ep_b2t'), t('ep_b2d')],
    [t('ep_b3t'), t('ep_b3d')],
  ]
  return (
    <Section num={t('ep_num')} label={t('ep_badge')} title={t('ep_h2')} desc={t('ep_desc')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 40, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
          {bullets.map(([t, d], i) => (
            <div key={t} style={{ padding: '20px 22px', borderTop: i ? '1px solid var(--line)' : 'none', display: 'flex', gap: 14, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{`0${i + 1}`}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{t}</div>
                <div style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', border: '1.5px solid var(--ink)', borderRadius: 'var(--radius)', background: 'var(--paper)' }}>
          <CornerTicks />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 30, height: 30, borderRadius: 'var(--radius)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{t('ep_profile_initials')}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>{t('ep_profile_name')}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{t('ep_profile_grade')}</div>
              </div>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', textAlign: 'right', lineHeight: 1.4 }}>{t('ep_profile_tests')}<br />{t('ep_profile_errors')}</span>
          </div>
          <div style={{ padding: '8px 20px 16px' }}>
            {topics.map(([name, frac, cnt, worst], i) => (
              <div key={name} style={{ padding: '13px 0', borderBottom: i < topics.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {worst && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--btn-fg)', background: 'var(--ink)', padding: '3px 7px', borderRadius: 'var(--radius)', whiteSpace: 'nowrap' }}>{t('ep_tag')}</span>}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', minWidth: 56, textAlign: 'right' }}>{cnt}{t('ep_errors_sfx')}</span>
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${frac * 100}%`, background: 'var(--ink)' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--paper-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{t('ep_updated')}</span>
            <Link href="/profile" style={{ ...btnPrimary, textDecoration: 'none', fontSize: 13, padding: '9px 14px', display: 'inline-block' }}>{t('ep_btn')}</Link>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────
function FAQSection() {
  const t = useTranslations('PdfInfoPage')
  const items = [
    [t('faq1_q'), t('faq1_a')],
    [t('faq2_q'), t('faq2_a')],
    [t('faq3_q'), t('faq3_a')],
    [t('faq4_q'), t('faq4_a')],
    [t('faq5_q'), t('faq5_a')],
    [t('faq6_q'), t('faq6_a')],
    [t('faq7_q'), t('faq7_a')],
  ]
  const [open, setOpen] = useState(0)
  return (
    <Section num="— / —" label={t('faq_badge')} title={t('faq_h2')}>
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
        {items.map(([q, a], i) => {
          const isOpen = open === i
          return (
            <div key={i} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, font: 'inherit', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: '20px 24px', color: 'var(--ink)' }}>
                <span style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>{q}</span>
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--ink-2)', lineHeight: 1, flexShrink: 0 }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <div style={{ padding: '0 24px 22px 50px', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 720 }}>{a}</div>}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── SEO text ─────────────────────────────────────────────────
function SeoText() {
  const t = useTranslations('PdfInfoPage')
  const tags = [t('seo_tag1'), t('seo_tag2'), t('seo_tag3'), t('seo_tag4'), t('seo_tag5'), t('seo_tag6'), t('seo_tag7'), t('seo_tag8'), t('seo_tag9'), t('seo_tag10'), t('seo_tag11'), t('seo_tag12')]
  return (
    <section style={{ padding: '76px 0', borderTop: '1px solid var(--line)' }}>
      <Eyebrow style={{ marginBottom: 22 }}>{t('seo_badge')}</Eyebrow>
      <h2 style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0, maxWidth: 820 }}>
        {t('seo_h2')}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 44, marginTop: 32 }}>
        <div style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
          <p style={{ margin: '0 0 16px' }}><strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{t('seo_p1a')}</strong>{t('seo_p1b')}</p>
          <p style={{ margin: 0 }}>{t('seo_p2')}</p>
        </div>
        <div style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
          <p style={{ margin: '0 0 16px' }}>{t('seo_p3_intro')}<strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{t('seo_p3a')}</strong>{t('seo_p3b')}</p>
          <p style={{ margin: 0 }}>{t('seo_p4')}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 32 }}>
        {tags.map(tag => <span key={tag} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', padding: '6px 11px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--paper-2)' }}>{tag}</span>)}
      </div>
    </section>
  )
}

// ── ClosingCTA ────────────────────────────────────────────────
function ClosingCTA() {
  const t = useTranslations('PdfInfoPage')
  return (
    <section className="tt-cta-wrap" style={{ margin: '0 calc(50% - 50vw)', padding: '88px 0' }}>
      <div style={{ maxWidth: MAXW, margin: '0 auto', padding: '0 clamp(20px, 5vw, 32px)', textAlign: 'center' }}>
        <Eyebrow style={{ justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ width: 22, height: 1, background: '#fff', display: 'inline-block' }} />
          {t('cta_badge')}
        </Eyebrow>
        <h2 style={{ fontSize: 'clamp(32px, 5.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02, margin: '22px auto 0', maxWidth: 700 }}>
          {t('cta_h2')}<br />{t('cta_h2b')}
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', maxWidth: 520, margin: '18px auto 0', lineHeight: 1.55 }}>{t('cta_desc')}</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
          <Link href="/profile" style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#0c0c0d', border: '1.5px solid #fff', padding: '14px 26px', borderRadius: 'var(--radius)', textDecoration: 'none', display: 'inline-block' }}>{t('cta_btn1')}</Link>
          <a href="#demo" style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', padding: '14px 26px', borderRadius: 'var(--radius)', textDecoration: 'none', display: 'inline-block' }}>{t('cta_btn2')}</a>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────
function Footer() {
  const t = useTranslations('PdfInfoPage')
  const cols: [string, string[]][] = [
    [t('footer_col1'), [t('footer_col1_1'), t('footer_col1_2'), t('footer_col1_3'), t('footer_col1_4')]],
    [t('footer_col2'), [t('footer_col2_1'), t('footer_col2_2'), t('footer_col2_3'), t('footer_col2_4')]],
    [t('footer_col3'), [t('footer_col3_1'), t('footer_col3_2'), t('footer_col3_3')]],
  ]
  return (
    <footer style={{ paddingTop: 56, paddingBottom: 48, borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>GoodWorker</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-2)' }}>{t('footer_brand')}</span>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 12, maxWidth: 240, lineHeight: 1.5 }}>{t('footer_tagline')}</p>
        </div>
        {cols.map(([h, links]) => (
          <div key={h}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 14 }}>{h}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {links.map(l => <span key={l} style={{ fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer' }}>{l}</span>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{t('footer_copy')}</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/privacy" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>{t('footer_privacy')}</Link>
          <Link href="/terms" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>{t('footer_terms')}</Link>
        </div>
      </div>
    </footer>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function PdfInfoPage() {
  useEffect(() => {
    document.body.style.setProperty('overflow', 'auto', 'important')
    return () => { document.body.style.removeProperty('overflow') }
  }, [])

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'inherit' }}>
      <style>{CSS}</style>
      {/* grid background */}
      <div className="tt-grid" />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: MAXW, margin: '0 auto', padding: '0 clamp(18px, 4vw, 32px)' }}>
        <Nav />
        <Hero />
        <HowItWorks />
        <QuestionTypes />
        <ResultShowcase />
        <StructureSection />
        <ErrorProfileSection />
        <FAQSection />
        <SeoText />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ClosingCTA />
      </div>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: MAXW, margin: '0 auto', padding: '0 clamp(18px, 4vw, 32px)' }}>
        <Footer />
      </div>
    </div>
  )
}
