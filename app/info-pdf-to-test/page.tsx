'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
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

const btnPrimary: React.CSSProperties = { fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--ink)', color: '#fff', border: '1.5px solid var(--ink)', padding: '11px 18px', borderRadius: 'var(--radius)' }
const btnGhost: React.CSSProperties = { fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'var(--ink)', border: '1.5px solid var(--line)', padding: '11px 18px', borderRadius: 'var(--radius)' }

// ── Nav ───────────────────────────────────────────────────────
function Nav() {
  const links = ['Как работает', 'Типы вопросов', 'Демо', 'FAQ']
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>GoodWorker</Link>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink-2)', textTransform: 'uppercase' }}>/ Тесты</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div className="tt-navlinks" style={{ display: 'flex', gap: 26 }}>
          {links.map(l => (
            <span key={l} style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.04em', color: 'var(--ink-2)', cursor: 'pointer' }}>{l}</span>
          ))}
        </div>
        <Link href="/profile" style={{ ...btnPrimary, textDecoration: 'none', fontSize: 13, display: 'inline-block' }}>Загрузить PDF</Link>
      </div>
    </nav>
  )
}

// ── TrustRow ──────────────────────────────────────────────────
function TrustRow() {
  const items = ['Учителя школ', 'Репетиторы', 'Учебные центры', 'Подготовка к ЦЭ / ЦТ']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Для кого</span>
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
    <div style={{ position: 'relative', background: '#fff', border: '1px solid var(--line)', padding: '18px 18px 22px', height: '100%', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
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
              border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : '#fff',
              color: on ? '#fff' : 'var(--ink)', padding: '11px 13px', borderRadius: 'var(--radius)',
              font: 'inherit', fontSize: 14, transition: 'border-color .12s, background .12s',
            }}>
              <span style={{ width: 18, height: 18, flexShrink: 0, border: `1.5px solid ${on ? '#fff' : 'var(--ink-3)'}`, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 10 }}>
                {on ? '✓' : String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{o}</span>
              {showState && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', opacity: 0.8 }}>{isCorrect ? 'ВЕРНО' : (on ? 'НЕВЕРНО' : '')}</span>}
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
  const label = { single: 'ВЫБОР ОДНОГО', multi: 'ВЫБОР НЕСКОЛЬКИХ', match: 'СОПОСТАВЛЕНИЕ', fill: 'ВВОД ОТВЕТА', bool: 'ВЕРНО / НЕВЕРНО', order: 'ПОРЯДОК' }[q.type]
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, background: 'var(--paper-2)', marginBottom: 0 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 10 }}>ВОПРОС {idx + 1} / {total} · {label}</div>
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
          <FillIn answer={q.answer} placeholder="введите ответ…" />
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
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user

  const [state, setState] = useState<'idle' | 'drag' | 'processing' | 'done' | 'error'>('idle')
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
      [300,  '→ загрузка файла…'],
      [900,  '→ открытие документа…'],
      [2200, `→ парсинг страниц документа`],
      [4500, '→ распознавание структуры…'],
      [7000, '→ анализ вопросов ИИ…'],
      [10000,'→ определение типов заданий…'],
      [14000,'→ финализация…'],
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
      if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`)

      clearAll()
      setProgress(100)
      addLog(`✓ тест собран — ${(data as TestResult).questions.length} вопросов`)
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
    const typeTags = Object.entries(typeCount).map(([t, n]) => {
      const labels: Record<string, string> = { single: 'выбор', multi: 'несколько', match: 'пары', fill: 'ввод', bool: 'да/нет', order: 'порядок' }
      return `${labels[t] ?? t} ×${n}`
    })
    return (
      <div style={{ position: 'relative', border: '1.5px solid var(--ink)', background: '#fff', borderRadius: 'var(--radius)', padding: 24 }}>
        <CornerTicks />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 24, height: 24, borderRadius: 'var(--radius)', background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>✓</span>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{result.title}</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            {qs.length} ВОПРОСОВ · {result.pageCount} СТР{result.ocr ? ' · OCR' : ''}
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
              <button key={i} type="button" onClick={() => setPreviewIdx(i)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', border: `1px solid ${i === previewIdx ? 'var(--ink)' : 'var(--line)'}`, background: i === previewIdx ? 'var(--ink)' : '#fff', color: i === previewIdx ? '#fff' : 'var(--ink-3)', borderRadius: 'var(--radius)' }}>{i + 1}</button>
            ))}
          </div>
        )}

        {/* Guest notice */}
        {result.isGuest && (
          <div style={{ marginTop: 16, padding: '10px 14px', border: '1px dashed var(--line)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Бесплатный просмотр: {result.guestLimit} вопросов с одной страницы.{' '}
            <Link href="/auth/register" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>Зарегистрируйтесь</Link>{' '}
            — чтобы обработать весь документ, сохранить и поделиться тестом.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          {isLoggedIn
            ? <Link href="/profile" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Сохранить тест →</Link>
            : <Link href="/auth/register" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Войти и сохранить →</Link>
          }
          <button type="button" onClick={reset} style={btnGhost}>Загрузить другой</button>
        </div>
      </div>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────
  if (state === 'error') return (
    <div style={{ position: 'relative', border: '1.5px solid var(--ink)', background: '#fff', borderRadius: 'var(--radius)', padding: 24 }}>
      <CornerTicks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 24, height: 24, borderRadius: 'var(--radius)', background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}>✗</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Не удалось обработать файл</span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>{errorMsg}</p>
      <button type="button" onClick={reset} style={btnPrimary}>Попробовать снова</button>
    </div>
  )

  // ── PROCESSING ────────────────────────────────────────────────
  if (state === 'processing') return (
    <div style={{ position: 'relative', border: '1.5px solid var(--ink)', background: '#fff', borderRadius: 'var(--radius)', padding: 22 }}>
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
          Обработка без регистрации: до 5 вопросов с первой страницы.
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
        color: active ? '#fff' : 'var(--ink)',
        borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
        transition: 'background .15s, border-color .15s, color .15s', userSelect: 'none',
      }}>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }}
        onChange={e => onFiles(e.target.files)} onClick={e => e.stopPropagation()} />
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'var(--ink)'} strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" style={{ transform: active ? 'translateY(-2px)' : 'none', transition: 'transform .15s' }}>
        <path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M3 14v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6" />
      </svg>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 16, letterSpacing: '-0.01em' }}>{active ? 'Отпустите файл' : 'Перетащите PDF сюда'}</div>
      <div style={{ fontSize: 14, color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-2)', marginTop: 6 }}>или нажмите, чтобы выбрать файл</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 20 }} onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => inputRef.current?.click()} style={{ ...btnPrimary, ...(active ? { background: '#fff', color: 'var(--ink)' } : {}) }}>Загрузить PDF</button>
      </div>
      {!isLoggedIn && (
        <div style={{ marginTop: 16, fontSize: 12.5, color: active ? 'rgba(255,255,255,0.65)' : 'var(--ink-3)', lineHeight: 1.45, maxWidth: 320 }}>
          Без регистрации: до 5 вопросов бесплатно.{' '}
          <Link href="/auth/register" onClick={e => e.stopPropagation()} style={{ color: active ? 'rgba(255,255,255,0.9)' : 'var(--ink-2)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Войти</Link>
          {' '}— полный документ и сохранение.
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: active ? 'rgba(255,255,255,0.5)' : 'var(--ink-3)', textAlign: 'center' }}>PDF · ДО 50 МБ</div>
    </div>
  )
}

// ── Hero (variant B — centred) ────────────────────────────────
function Hero() {
  return (
    <section style={{ padding: '64px 0 80px', textAlign: 'center' }}>
      <Eyebrow style={{ justifyContent: 'center', marginBottom: 24 }}>PDF → ЭЛЕКТРОННЫЙ ТЕСТ</Eyebrow>
      <h1 style={{ fontSize: 'clamp(36px, 7vw, 66px)', lineHeight: 1.0, fontWeight: 800, letterSpacing: '-0.035em', margin: '0 auto', maxWidth: 880, color: 'var(--ink)' }}>
        Из PDF — в готовый тест.<br />Автоматически.
      </h1>
      <p style={{ fontSize: 'clamp(15px, 2.4vw, 18px)', lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 600, margin: '22px auto 0' }}>
        Загрузите PDF с вопросами и ответами — получите готовый тест на вашем сайте. Выбор вариантов, сопоставление пар, ввод ответа — структуру распознаём автоматически.
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
  const steps = [
    { n: '01', t: 'Загрузка PDF', d: 'Бросьте файл с вопросами и ответами. Подходят экзамены, домашки, варианты ЦЭ/ЦТ — в любом порядке.', glyph: 'doc' },
    { n: '02', t: 'Распознавание', d: 'Парсим текст, находим вопросы и варианты, определяем тип каждого задания и правильные ответы.', glyph: 'scan' },
    { n: '03', t: 'Готовый тест', d: 'Получаете интерактивный тест по ссылке. Студенты проходят онлайн, результаты считаются автоматически.', glyph: 'screen' },
  ]
  return (
    <Section num="01 / 05" label="Как это работает" title="Три шага от файла до теста"
      desc="Без ручного переноса вопросов. Загрузка занимает секунды, распознавание — около минуты на вариант.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ padding: 28, borderLeft: i ? '1px solid var(--line)' : 'none', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--ink)' }}>{s.n}</span>
              <StepGlyph kind={s.glyph} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{s.t}</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)', marginTop: 10, marginBottom: 0 }}>{s.d}</p>
            {i < 2 && (
              <span style={{
                position: 'absolute', right: -9, top: '50%', transform: 'translateY(-50%)', zIndex: 1,
                width: 18, height: 18, background: '#fff', border: '1px solid var(--line)', borderRadius: '50%',
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
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 22, background: '#fff', display: 'flex', flexDirection: 'column' }}>
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
          <button key={i} type="button" onClick={() => toggle(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', font: 'inherit', fontSize: 13.5, border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: '#fff', color: 'var(--ink)', padding: '9px 11px', borderRadius: 'var(--radius)' }}>
            <span style={{ width: 16, height: 16, flexShrink: 0, border: `1.5px solid ${on ? 'var(--ink)' : 'var(--ink-3)'}`, background: on ? 'var(--ink)' : '#fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{on ? '✓' : ''}</span>
            {o}
          </button>
        )
      })}
    </div>
  )
}

function MatchPairs({ left, right }: { left: string[]; right: string[] }) {
  const [val, setVal] = useState(left.map(() => ''))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {left.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--paper-2)' }}>{l}</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontSize: 13 }}>→</span>
          <select value={val[i]} onChange={e => setVal(v => v.map((x, j) => j === i ? e.target.value : x))} style={{ flex: 1, font: 'inherit', fontSize: 13.5, padding: '8px', border: `1px solid ${val[i] ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 'var(--radius)', background: '#fff', cursor: 'pointer' }}>
            <option value="">— выбрать —</option>
            {right.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

function FillIn({ answer, placeholder }: { answer: string; placeholder: string }) {
  const [v, setV] = useState('')
  const [checked, setChecked] = useState(false)
  const ok = v.trim().toLowerCase() === answer.toLowerCase()
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={v} placeholder={placeholder} onChange={e => { setV(e.target.value); setChecked(false) }} style={{ flex: 1, font: 'inherit', fontSize: 14, padding: '10px 12px', border: `1px solid ${checked ? (ok ? 'var(--ink)' : 'var(--ink-3)') : 'var(--line)'}`, borderRadius: 'var(--radius)', outline: 'none', color: 'var(--ink)' }} />
        <button type="button" onClick={() => setChecked(true)} style={{ ...btnPrimary, padding: '10px 14px', fontSize: 13 }}>OK</button>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 9, color: 'var(--ink-2)', minHeight: 14 }}>
        {checked ? (ok ? '✓ верно' : '✗ попробуйте ещё') : 'введите ответ и нажмите OK'}
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
        <div key={it} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: '#fff' }}>
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
  const [v, setV] = useState<boolean | null>(null)
  return (
    <div>
      <div style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 14, color: 'var(--ink)' }}>«JSX компилируется в вызовы React.createElement».</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['Верно', true], ['Неверно', false]].map(([lbl, val]) => {
          const on = v === val
          return (
            <button key={String(lbl)} type="button" onClick={() => setV(val as boolean)} style={{ flex: 1, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '11px 0', border: `1.5px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : '#fff', color: on ? '#fff' : 'var(--ink)', borderRadius: 'var(--radius)' }}>{lbl}</button>
          )
        })}
      </div>
    </div>
  )
}

function QuestionTypes() {
  return (
    <Section num="02 / 05" label="Типы вопросов" title="Шесть форматов заданий" desc="Распознаём и собираем все основные типы. Кликайте — карточки ниже рабочие.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
        <QTCard tag="SINGLE" title="Выбор одного">
          <SingleChoice options={['8 бит', '16 бит', '32 бита', '64 бита']} correct={0} />
        </QTCard>
        <QTCard tag="MULTI" title="Выбор нескольких">
          <MultiChoice options={['HTTP', 'TCP', 'SMTP', 'IP']} />
        </QTCard>
        <QTCard tag="MATCH" title="Сопоставление пар">
          <MatchPairs left={['HTML', 'CSS', 'JS']} right={['стиль', 'логика', 'разметка']} />
        </QTCard>
        <QTCard tag="INPUT" title="Ввод ответа">
          <FillIn answer="16" placeholder="число…" />
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>2⁴ = ?</div>
        </QTCard>
        <QTCard tag="ORDER" title="Упорядочивание">
          <OrderingQ items={['Анализ', 'Проектирование', 'Разработка', 'Тестирование']} />
        </QTCard>
        <QTCard tag="BOOL" title="Верно / неверно">
          <TrueFalseQ />
        </QTCard>
      </div>
    </Section>
  )
}

// ── ResultShowcase ────────────────────────────────────────────
function ResultShowcase() {
  const grid = Array.from({ length: 12 }, (_, i) => i + 1)
  const cur = 3
  return (
    <Section num="03 / 05" label="Демо результата" title="Так выглядит готовый тест" desc="Чистый интерфейс прохождения: прогресс, навигация по вопросам, мгновенная проверка.">
      <div style={{ border: '1.5px solid var(--ink)', borderRadius: 'var(--radius)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 9, border: '1px solid var(--ink-3)', borderRadius: 'var(--radius)', display: 'inline-block' }} />)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '0.04em' }}>ЦЭ · Информатика · Вариант 7</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>⏱ 14:32</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
          <div style={{ padding: 32, borderRight: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>ВОПРОС {cur} / 12 · ВЫБОР ОТВЕТА</span>
              <div style={{ height: 4, width: 160, background: 'var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(cur / 12) * 100}%`, background: 'var(--ink)' }} />
              </div>
            </div>
            <SingleChoice question="Какая структура данных работает по принципу LIFO?" options={['Очередь (queue)', 'Стек (stack)', 'Связный список', 'Хеш-таблица']} correct={1} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button type="button" style={{ ...btnGhost, fontSize: 14 }}>← Назад</button>
              <button type="button" style={{ ...btnPrimary, fontSize: 14 }}>Далее →</button>
            </div>
          </div>
          <div style={{ padding: 24, background: 'var(--paper-2)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 14 }}>ВОПРОСЫ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
              {grid.map(n => {
                const done = n < cur, active = n === cur
                return (
                  <span key={n} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13, borderRadius: 'var(--radius)', border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`, background: active ? 'var(--ink)' : done ? 'var(--ink)' : '#fff', color: (active || done) ? '#fff' : 'var(--ink-3)', opacity: done && !active ? 0.55 : 1 }}>
                    {done ? '✓' : n}
                  </span>
                )
              })}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)' }}>Отвечено</span><span style={{ fontFamily: 'var(--mono)' }}>2 / 12</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--ink-2)' }}>Осталось</span><span style={{ fontFamily: 'var(--mono)' }}>10</span></div>
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
  const facts = [['12', 'вопросов в варианте'], ['4', 'типа заданий'], ['~60', 'секунд на разбор']]
  const stageNames = ['UPLOAD', 'LOADING', 'DOC', 'TEST']
  const [stage, setStage] = useState(0)
  return (
    <Section num="04 / 05" label="Под капотом" title="От загрузки — до теста с картинками"
      desc="Стрелка загрузки превращается в обработку, затем — в документ с текстом и фото, а после — в интерактивный тест. Следите за превращением справа.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 40, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
            {[['↑', 'Загрузка', 'PDF, скан или фото страницы'], ['◐', 'Распознавание', 'ИИ читает текст и изображения'], ['▦', 'Документ', 'разбираем вопросы и вложения'], ['✓', 'Сборка теста', 'интерактив с картинками внутри']].map(([k, t, d], i) => {
              const on = stage === i
              return (
                <div key={t} style={{ padding: '18px 20px', borderTop: i ? '1px solid var(--line)' : 'none', display: 'flex', gap: 14, alignItems: 'baseline', background: on ? 'var(--ink)' : 'transparent', color: on ? '#fff' : 'inherit', transition: 'background .35s, color .35s', cursor: 'pointer' }} onClick={() => setStage(i)}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: on ? '#fff' : 'var(--ink-3)', width: 24, textAlign: 'center' }}>{k}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{t}</div>
                    <div style={{ fontSize: 14, color: on ? 'rgba(255,255,255,0.75)' : 'var(--ink-2)', marginTop: 3 }}>{d}</div>
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
  const topics: [string, number, number, boolean][] = [
    ['Производные', 0.72, 9, true], ['Тригонометрия', 0.45, 6, false],
    ['Логарифмы', 0.3, 4, false], ['Стереометрия', 0.88, 11, true],
  ]
  const bullets = [
    ['Автосбор', 'ошибки заносятся в профиль после каждого теста — без ручной тетради'],
    ['Группировка', 'по темам и типам заданий: видно, где системный пробел'],
    ['План для репетитора', 'занятие начинается с самого слабого места ученика'],
  ]
  return (
    <Section num="05 / 05" label="После теста" title="Ошибки сами попадают в профиль ученика"
      desc="ИИ запоминает каждую ошибку и группирует их по темам. Репетитору не нужно искать слабые места вручную — он сразу видит, что проседает.">
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
        <div style={{ position: 'relative', border: '1.5px solid var(--ink)', borderRadius: 'var(--radius)', background: '#fff' }}>
          <CornerTicks />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 30, height: 30, borderRadius: 'var(--radius)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>АК</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>Профиль · Анна К.</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>11 КЛАСС · ЦЭ МАТЕМАТИКА</div>
              </div>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', textAlign: 'right', lineHeight: 1.4 }}>12 ТЕСТОВ<br />38 ОШИБОК</span>
          </div>
          <div style={{ padding: '8px 20px 16px' }}>
            {topics.map(([name, frac, cnt, worst], i) => (
              <div key={name} style={{ padding: '13px 0', borderBottom: i < topics.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {worst && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em', color: '#fff', background: 'var(--ink)', padding: '3px 7px', borderRadius: 'var(--radius)', whiteSpace: 'nowrap' }}>К РЕПЕТИТОРУ</span>}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', minWidth: 56, textAlign: 'right' }}>{cnt} ошиб.</span>
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${frac * 100}%`, background: 'var(--ink)' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--paper-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Обновлено ИИ после теста №12</span>
            <Link href="/profile" style={{ ...btnPrimary, textDecoration: 'none', fontSize: 13, padding: '9px 14px', display: 'inline-block' }}>Разобрать с репетитором →</Link>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────
function FAQSection() {
  const items = [
    ['Какие форматы файлов поддерживаются?', 'PDF и DOCX до 50 МБ. Документ может содержать несколько вариантов и любые типы вопросов вперемешку — мы разделим их сами.'],
    ['Нужно ли размечать вопросы вручную?', 'Нет. Сервис сам находит формулировки, варианты ответов и определяет тип задания. Если в файле указаны правильные ответы — подтянем и их.'],
    ['Распознаёт ли сервис формулы и изображения?', 'Текстовые формулы и таблицы — да. Картинки и схемы подгружаются как вложения к вопросу, их можно поправить в редакторе перед публикацией.'],
    ['Можно ли отредактировать тест после импорта?', 'Да. После распознавания открывается редактор: правьте формулировки, варианты, баллы и тип любого вопроса перед тем, как дать ссылку студентам.'],
    ['Как студенты проходят тест?', 'По ссылке — без установки и регистрации. Результаты и статистика по каждому вопросу собираются в вашем кабинете автоматически.'],
    ['Что происходит с ошибками учеников?', 'После прохождения теста ИИ автоматически заносит ошибки в профиль ученика и группирует их по темам и типам заданий. Репетитор сразу видит слабые места.'],
    ['Что с безопасностью данных?', 'Файлы обрабатываются и хранятся в вашем аккаунте, доступ — только по вашим ссылкам. Загруженные PDF можно удалить в любой момент.'],
  ]
  const [open, setOpen] = useState(0)
  return (
    <Section num="— / —" label="FAQ" title="Частые вопросы">
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
  const tags = ['тесты из PDF', 'конструктор тестов', 'онлайн-тестирование', 'подготовка к ЦЭ', 'подготовка к ЦТ', 'тесты для школы', 'тесты для репетитора', 'импорт вопросов из PDF', 'электронные тесты', 'тест по ссылке', 'автопроверка', 'сопоставление пар']
  return (
    <section style={{ padding: '76px 0', borderTop: '1px solid var(--line)' }}>
      <Eyebrow style={{ marginBottom: 22 }}>О сервисе</Eyebrow>
      <h2 style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0, maxWidth: 820 }}>
        Электронные тесты из PDF — для любого предмета и формата подготовки
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 44, marginTop: 32 }}>
        <div style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
          <p style={{ margin: '0 0 16px' }}><strong style={{ color: 'var(--ink)', fontWeight: 600 }}>GoodWorker Тесты</strong> превращает обычный PDF с вопросами и ответами в интерактивный тест. Загрузите вариант ЦЭ или ЦТ, школьную контрольную, домашнее задание или подборку вопросов — сервис распознаёт структуру документа и собирает готовый тест, который ученики проходят онлайн.</p>
          <p style={{ margin: 0 }}>Поддерживаются все основные типы заданий: выбор одного или нескольких вариантов, сопоставление пар, ввод ответа, упорядочивание и «верно / неверно». Результаты считаются автоматически.</p>
        </div>
        <div style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
          <p style={{ margin: '0 0 16px' }}>Сервис создан для <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>учителей школ, репетиторов и учебных центров</strong>, которые готовят учеников к централизованному экзамену. Один загруженный файл — готовый онлайн-тренажёр: его можно отправить ссылкой, встроить в курс или провести как проверочную работу прямо на уроке.</p>
          <p style={{ margin: 0 }}>Перед публикацией любой тест открывается в редакторе — поправьте формулировки, баллы и тип вопроса, добавьте изображения и таймер.</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 32 }}>
        {tags.map(t => <span key={t} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', padding: '6px 11px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--paper-2)' }}>{t}</span>)}
      </div>
    </section>
  )
}

// ── ClosingCTA ────────────────────────────────────────────────
function ClosingCTA() {
  return (
    <section style={{ background: 'var(--ink)', color: '#fff', margin: '0 calc(50% - 50vw)', padding: '88px 0' }}>
      <div style={{ maxWidth: MAXW, margin: '0 auto', padding: '0 clamp(20px, 5vw, 32px)', textAlign: 'center' }}>
        <Eyebrow style={{ justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ width: 22, height: 1, background: '#fff', display: 'inline-block' }} />
          НАЧНИТЕ СЕЙЧАС
        </Eyebrow>
        <h2 style={{ fontSize: 'clamp(32px, 5.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02, margin: '22px auto 0', maxWidth: 700 }}>
          Загрузите первый PDF —<br />тест будет готов к перемене.
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', maxWidth: 520, margin: '18px auto 0', lineHeight: 1.55 }}>Бесплатно для первых трёх тестов. Без карты, без установки.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
          <Link href="/profile" style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', background: '#fff', color: 'var(--ink)', border: '1.5px solid #fff', padding: '14px 26px', borderRadius: 'var(--radius)', textDecoration: 'none', display: 'inline-block' }}>Загрузить PDF</Link>
          <a href="#demo" style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', padding: '14px 26px', borderRadius: 'var(--radius)', textDecoration: 'none', display: 'inline-block' }}>Посмотреть демо</a>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────
function Footer() {
  const cols: [string, string[]][] = [
    ['Продукт', ['Как работает', 'Типы вопросов', 'Цены', 'Демо']],
    ['Ресурсы', ['Документация', 'Поддержка', 'Статус', 'API']],
    ['Компания', ['О GoodWorker', 'Блог', 'Контакты']],
  ]
  return (
    <footer style={{ paddingTop: 56, paddingBottom: 48, borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>GoodWorker</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-2)' }}>/ ТЕСТЫ</span>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 12, maxWidth: 240, lineHeight: 1.5 }}>PDF в интерактивные тесты для учителей, репетиторов и учебных центров.</p>
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
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>© 2026 GoodWorker</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/privacy" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>Конфиденциальность</Link>
          <Link href="/terms" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>Условия</Link>
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
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'linear-gradient(to right, rgba(12,12,13,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,12,13,0.035) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
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
