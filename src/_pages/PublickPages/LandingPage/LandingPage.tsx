'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import TypingText from './TypingText'
import s from './LandingPage.module.scss'

const KnowledgeGlobe    = dynamic(() => import('./KnowledgeGlobe'),    { ssr: false })
const ThreeShape        = dynamic(() => import('./ThreeShape'),        { ssr: false })
const CourseFlow        = dynamic(() => import('./CourseFlow'),        { ssr: false })
const PdfParticleAnim   = dynamic(() => import('./PdfParticleAnim'),   { ssr: false })

const RED = '#ED0606'

// ─── Avatar ────────────────────────────────────────────────────
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('')
  const seed = name.charCodeAt(0) + (name.charCodeAt(1) || 0)
  const hueA = (seed * 37) % 360
  const hueB = (hueA + 60) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, hsl(${hueA} 60% 62%), hsl(${hueB} 55% 42%))`,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.36, letterSpacing: '-0.02em',
    }}>{initials}</div>
  )
}

// ─── Hero ───────────────────────────────────────────────────────
function HeroSection() {
  return (
    <div className={s.hero}>
      <div className={s.hero_left}>
        <div className={s.hero_greeting}>
          <span className={s.hero_greeting_name}>С возвращением, Иван.</span>
          <span className={s.hero_greeting_sub}> Сегодня 3 занятия и звонок в 18:00.</span>
        </div>

        <h1 className={s.hero_h1}>
          Учитесь там,{' '}
          <span style={{ color: RED }}>где знания связаны</span>
        </h1>

        <div className={s.hero_typing}>
          <TypingText
            phrases={[
              'Собирайте курсы как графы знаний.',
              'Записывайте звонки с авто-конспектом.',
              'Учитесь оффлайн, обсуждайте в постах.',
              'Преподавайте без барьеров и подписок.',
            ]}
            accent={RED}
          />
        </div>

        <p className={s.hero_desc}>
          GoodWorker — open-платформа для учителей и студентов: визуальный конструктор
          уроков, авто-транскрипция звонков, общая лента постов и календарь занятий — всё в одном месте.
        </p>

        <div className={s.hero_stats}>
          <StatItem n="2.4k" label="звонков" first />
          <StatItem n="380+" label="учеников" />
          <StatItem n="42" label="учителей" />
          <StatItem n="120" label="курсов" />
        </div>

        <div className={s.hero_cta}>
          <Link href="/profile" className={s.btn_dark}>
            Создать курс <span>+</span>
          </Link>
          <button className={s.btn_outline}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Как это работает · 2:14
          </button>
        </div>
      </div>

      <div className={s.hero_globe}>
        <KnowledgeGlobe />
      </div>
    </div>
  )
}

function StatItem({ n, label, first }: { n: string; label: string; first?: boolean }) {
  return (
    <div className={s.stat_item} style={{ borderLeft: first ? 'none' : '1px solid #ececf2' }}>
      <div className={s.stat_n}>{n}</div>
      <div className={s.stat_label}>{label}</div>
    </div>
  )
}

// ─── Video Section ──────────────────────────────────────────────
const VIDEO_SUBS = [
  { speaker: 'Анна', text: 'Продолжаем — сегодня разбираем замыкания в JavaScript.' },
  { speaker: 'Иван', text: 'А в чём разница замыкания и области видимости?' },
  { speaker: 'Анна', text: 'Скоп определяет правила, замыкание — захватывает переменные внутрь функции.' },
  { speaker: 'Мария', text: 'Можно показать пример с функцией-счётчиком?' },
  { speaker: 'Анна', text: 'const make = () => { let n = 0; return () => ++n }' },
  { speaker: 'Иван', text: 'Понял! Каждый вызов make — новый независимый счётчик.' },
]

const TRANSCRIPT = [
  { role: 'teacher', name: 'Анна Петрова', time: '00:03', text: 'Сегодня разбираем замыкания в JavaScript — одна из ключевых тем для понимания React.' },
  { role: 'teacher', name: 'Анна Петрова', time: '00:12', text: 'Замыкание — функция, которая помнит переменные из своей области видимости даже после завершения внешней функции.' },
  { role: 'student', name: 'Иван', time: '00:28', text: 'Чем это отличается от обычной области видимости?' },
  { role: 'teacher', name: 'Анна Петрова', time: '00:35', text: 'Скоп задаёт правила видимости. Замыкание — захватывает переменные и сохраняет их живыми внутри функции.' },
  { role: 'student', name: 'Мария', time: '00:51', text: 'Можно пример со счётчиком? Видела такое в хуках React.' },
  { role: 'teacher', name: 'Анна Петрова', time: '00:58', text: 'const makeCounter = () => { let n = 0; return () => ++n }. Каждый вызов makeCounter — отдельный счётчик.' },
  { role: 'student', name: 'Иван', time: '01:14', text: 'Значит n живёт в каждом замыкании отдельно, не пересекается!' },
  { role: 'teacher', name: 'Анна Петрова', time: '01:20', text: 'Именно. Задание: функция, создающая счётчик с произвольным шагом. Дедлайн — следующий урок.' },
]

function TranscriptModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(14,14,18,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 540,
        maxHeight: '82vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid #ececf2',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0e0e12' }}>Конспект урока</div>
            <div style={{ fontSize: 12, color: '#8c8c98', marginTop: 2 }}>JavaScript · Замыкания · 01:25</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #ececf2',
            background: '#f5f5f8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8c8c98" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {TRANSCRIPT.map((entry, i) => {
            const isTeacher = entry.role === 'teacher'
            return (
              <div key={i} style={{
                display: 'flex', gap: 10,
                flexDirection: isTeacher ? 'row' : 'row-reverse',
                alignItems: 'flex-start',
              }}>
                {/* Avatar circle */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: isTeacher
                    ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                    : 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>
                  {entry.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>

                {/* Bubble */}
                <div style={{ maxWidth: '76%' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                    flexDirection: isTeacher ? 'row' : 'row-reverse',
                  }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0e0e12' }}>{entry.name}</span>
                    <span style={{ fontSize: 10, color: '#b0b0bc' }}>{entry.time}</span>
                    {isTeacher && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
                        background: '#f0ebff', color: '#7c3aed',
                        padding: '1px 6px', borderRadius: 4,
                      }}>учитель</span>
                    )}
                  </div>
                  <div style={{
                    background: isTeacher ? '#f8f6ff' : '#f0f9ff',
                    border: `1px solid ${isTeacher ? '#e9e0ff' : '#bae6fd'}`,
                    borderRadius: isTeacher ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                    padding: '9px 13px',
                    fontSize: 13.5, lineHeight: 1.5, color: '#1a1a2e',
                    fontFamily: entry.text.includes('=>') ? 'JetBrains Mono, monospace' : 'inherit',
                  }}>{entry.text}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FeedTile({ name, hue, speaking, muted, floating, noLabel, style }: {
  name: string; hue: number; speaking?: boolean; muted?: boolean; floating?: boolean; noLabel?: boolean; style?: React.CSSProperties
}) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return (
    <div style={{
      position: 'relative', borderRadius: floating ? 14 : 22, overflow: 'hidden',
      background: `linear-gradient(150deg, hsl(${hue} 55% 30%), hsl(${hue + 30} 60% 18%))`,
      outline: speaking ? `2.5px solid ${RED}` : (floating ? '2px solid rgba(255,255,255,0.9)' : 'none'),
      ...style,
    }}>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.92)', fontWeight: 800,
        fontSize: floating ? 26 : 54, letterSpacing: '-0.02em',
      }}>{initials}</div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)',
      }} />
      {!noLabel && (
        <div style={{
          position: 'absolute', left: floating ? 8 : 14, bottom: floating ? 7 : 13,
          display: 'flex', alignItems: 'center', gap: 7, color: '#fff',
        }}>
          <span style={{
            width: floating ? 13 : 16, height: floating ? 13 : 16, borderRadius: 4,
            background: muted ? 'rgba(255,255,255,0.18)' : RED,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={floating ? 8 : 10} height={floating ? 8 : 10} viewBox="0 0 24 24" fill="#fff">
              {muted
                ? <path d="M19 11a7 7 0 0 1-14 0m7 7v3m-4 0h8M12 1a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V4a3 3 0 0 1 3-3z" />
                : <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z" />}
            </svg>
          </span>
          <span style={{ fontSize: floating ? 11.5 : 14, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{name}</span>
        </div>
      )}
    </div>
  )
}

// Draggable mini tile — starts at (right, top), switches to absolute left/top on first drag
function DraggableTile({ name, hue, muted, initRight, initTop, wrapRef }: {
  name: string; hue: number; muted?: boolean
  initRight: number; initTop: number
  wrapRef: React.RefObject<HTMLDivElement | null>
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null)
  const W = 110, H = 82

  const onDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    let startX = pos?.x ?? 0
    let startY = pos?.y ?? initTop
    if (pos === null && wrapRef.current) {
      startX = wrapRef.current.clientWidth - initRight - W
    }
    drag.current = { ox: e.clientX, oy: e.clientY, px: startX, py: startY }
    setPos({ x: startX, y: startY })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [pos, initRight, initTop, wrapRef])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const wrap = wrapRef.current
    const maxX = wrap ? wrap.clientWidth  - W : 9999
    const maxY = wrap ? wrap.clientHeight - H : 9999
    setPos({
      x: Math.max(0, Math.min(maxX, drag.current.px + (e.clientX - drag.current.ox))),
      y: Math.max(0, Math.min(maxY, drag.current.py + (e.clientY - drag.current.oy))),
    })
  }, [wrapRef])

  const onUp = useCallback(() => { drag.current = null }, [])

  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  const posStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { right: initRight, top: initTop }

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: 'absolute', ...posStyle,
        width: W, height: H, borderRadius: 14, overflow: 'hidden', cursor: 'grab',
        background: `linear-gradient(150deg, hsl(${hue} 55% 30%), hsl(${hue + 30} 60% 18%))`,
        outline: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)',
        userSelect: 'none', touchAction: 'none', zIndex: 10,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.92)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em',
      }}>{initials}</div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)',
      }} />
      <div style={{
        position: 'absolute', left: 8, bottom: 7,
        display: 'flex', alignItems: 'center', gap: 6, color: '#fff',
      }}>
        <span style={{
          width: 13, height: 13, borderRadius: 4,
          background: muted ? 'rgba(255,255,255,0.18)' : RED,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="#fff">
            {muted
              ? <path d="M19 11a7 7 0 0 1-14 0m7 7v3m-4 0h8M12 1a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V4a3 3 0 0 1 3-3z" />
              : <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z" />}
          </svg>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{name}</span>
      </div>
    </div>
  )
}

function VideoSection() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [subIdx, setSubIdx] = useState(0)
  const [subVis, setSubVis] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)

  const barMeta = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      delay: `${(i * 0.045 + Math.sin(i * 0.9) * 0.08).toFixed(3)}s`,
      dur:   `${(0.42 + Math.sin(i * 0.7) * 0.12).toFixed(3)}s`,
    }))
  , [])

  useEffect(() => {
    const id = setInterval(() => {
      setSubVis(false)
      setTimeout(() => { setSubIdx(i => (i + 1) % VIDEO_SUBS.length); setSubVis(true) }, 280)
    }, 3600)
    return () => clearInterval(id)
  }, [])

  const cur = VIDEO_SUBS[subIdx]

  return (
    <>
      <div className={s.section_grid}>
        <div ref={wrapRef} className={s.video_wrap}>
          <FeedTile name="Анна Петрова" hue={258} speaking noLabel style={{ aspectRatio: '16/10', width: '100%' }} />

          {/* Top-left: name (was "Запись урока") */}
          <div className={s.rec_badge}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg, hsl(258 55% 30%), hsl(288 60% 18%))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>АП</div>
            Анна Петрова
          </div>

          {/* Top-right: REC */}
          <div style={{
            position: 'absolute', top: 14, right: 14,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 999,
            background: 'rgba(14,14,18,0.55)', backdropFilter: 'blur(6px)',
            color: '#fff', fontSize: 11, fontWeight: 600,
          }}>
            <span className={s.pulse_dot} style={{ background: RED }} />
            REC
          </div>

          {/* Waveform + subtitles — bottom-left overlay */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(to top, rgba(14,14,18,0.72) 60%, transparent)',
            borderRadius: '0 0 22px 22px',
            padding: '28px 14px 14px',
            pointerEvents: 'none',
          }}>
            {/* Audio waveform bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 28, marginBottom: 8 }}>
              {barMeta.map((b, i) => (
                <div key={i} style={{
                  flex: 1, background: 'rgba(255,255,255,0.72)', borderRadius: 2,
                  transformOrigin: 'bottom',
                  animation: `wave_bar ${b.dur} ease-in-out ${b.delay} infinite alternate`,
                }} />
              ))}
            </div>

            {/* Subtitle */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              opacity: subVis ? 1 : 0,
              transition: 'opacity 0.28s ease',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#a78bfa',
                background: 'rgba(124,58,237,0.25)', padding: '1px 6px',
                borderRadius: 4, whiteSpace: 'nowrap', marginTop: 1,
                flexShrink: 0,
              }}>{cur.speaker}</span>
              <span style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.92)',
                lineHeight: 1.45, textShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}>{cur.text}</span>
            </div>
          </div>

          {/* Bottom-right: Просмотреть конспект */}
          <button
            onClick={() => setShowTranscript(true)}
            style={{
              position: 'absolute', bottom: 14, right: 14,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', pointerEvents: 'all',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
            Просмотреть конспект
          </button>

          {/* Draggable participant tiles */}
          <DraggableTile name="Иван"  hue={210} muted initRight={14} initTop={14}  wrapRef={wrapRef} />
          <DraggableTile name="Мария" hue={12}        initRight={14} initTop={108} wrapRef={wrapRef} />
        </div>

        <div>
          <div className={s.eyebrow}>Авто-конспект звонка</div>
          <h2 className={s.section_h2}>
            Урок ведёт <span style={{ color: RED }}>конспект</span> за вас
          </h2>
          <p className={s.section_text}>
            Пока идёт занятие, платформа расшифровывает речь и собирает структурированный конспект — с тезисами, заданиями и таймкодами. Ничего не нужно записывать вручную.
          </p>
          <p className={s.section_text} style={{ marginTop: 16 }}>
            <mark className={s.hl}>ИИ запоминает ошибки ученика и сохраняет их прямо в его профиль.</mark>{' '}
            Так репетитор экономит время на записи пройденного урока и сразу видит прогресс и слабые места.
          </p>
          <div className={s.check_list}>
            {[
              ['Конспект готов сразу после звонка', 'тезисы, задания и таймкоды'],
              ['Ошибки — в профиле ученика', 'ИИ группирует их по темам'],
              ['Меньше рутины', 'не нужно расписывать урок вручную'],
            ].map(([t, d]) => (
              <div key={t} className={s.check_item}>
                <span className={s.check_icon}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <div>
                  <div className={s.check_title}>{t}</div>
                  <div className={s.check_sub}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTranscript && <TranscriptModal onClose={() => setShowTranscript(false)} />}
    </>
  )
}

// ─── Course Section ─────────────────────────────────────────────
function CourseSection() {
  return (
    <div className={s.section_grid} style={{ direction: 'ltr' }}>
      <div className={s.course_preview}>
        <CourseFlow />
      </div>
      <div>
        <div className={s.eyebrow}>Конструктор курса</div>
        <h2 className={s.section_h2}>
          Курс как <span style={{ color: RED }}>схема знаний</span>
        </h2>
        <p className={s.section_text}>
          Визуальный редактор превращает разрозненный материал — файлы, тексты, тесты — в наглядную схему: ученику видно, как темы связаны между собой.
        </p>
        <p className={s.section_text} style={{ marginTop: 16 }}>
          <mark className={s.hl}>А готовый граф курса работает на саморекламу.</mark>{' '}
          Им удобно делиться, он показывает глубину программы и сам привлекает новых учеников.
        </p>
      </div>
    </div>
  )
}

function CourseMockup() {
  const nodes = [
    { label: 'Начало', x: 8, y: 28, w: 38 },
    { label: 'Файлы', x: 52, y: 8, w: 36 },
    { label: 'Текст', x: 52, y: 40, w: 36 },
    { label: 'Тест ✓', x: 78, y: 24, w: 34 },
  ]
  const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3]]
  return (
    <div className={s.course_mockup}>
      <div className={s.course_mockup_header}>
        <span className={s.course_mockup_title}>Конструктор курса</span>
        <span className={s.badge_accent}>REACT FLOW</span>
      </div>
      <div className={s.course_canvas}>
        <svg width="100%" height="100%" viewBox="0 0 120 70" preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0L10 5L0 10z" fill="#c4c4cc" />
            </marker>
          </defs>
          {edges.map(([a, b], i) => {
            const na = nodes[a], nb = nodes[b]
            const x1 = na.x + na.w, y1 = na.y + 6
            const x2 = nb.x, y2 = nb.y + 6
            const mx = (x1 + x2) / 2
            return <path key={i} d={`M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}`}
              fill="none" stroke="#d8d8e0" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#arr)" />
          })}
          {nodes.map((n, i) => (
            <g key={i}>
              <rect x={n.x} y={n.y} width={n.w} height={12} rx={3}
                fill={i === 3 ? RED : '#fff'} stroke={i === 3 ? RED : '#e2e2e9'} strokeWidth="1" />
              <text x={n.x + n.w / 2} y={n.y + 7.5} textAnchor="middle" dominantBaseline="middle"
                fontSize="4.5" fontWeight="600" fill={i === 3 ? '#fff' : '#0e0e12'}>{n.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ─── Calendar Section ───────────────────────────────────────────
function CalendarSection() {
  return (
    <div className={s.section_grid_rev}>
      <div>
        <div className={s.eyebrow}>Расписание</div>
        <h2 className={s.section_h2}>
          Всё расписание <span style={{ color: RED }}>в одном ритме</span>
        </h2>
        <p className={s.section_text}>
          Занятия, звонки и дедлайны — на одной неделе. Цветные метки по типам, напоминания и переход в звонок одним кликом.
        </p>
        <p className={s.section_text} style={{ marginTop: 16 }}>
          <mark className={s.hl}>Ученики не пропускают занятия, а вы видите загрузку наперёд.</mark>{' '}
          Меньше переносов и забытых уроков — больше стабильного дохода.
        </p>
      </div>
      <div>
        <CalendarMockup />
      </div>
    </div>
  )
}

// ─── Interactive Calendar Mockup ───────────────────────────────
const PALETTE = [
  { color: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
  { color: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e' },
  { color: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
  { color: '#fef3c7', border: '#fcd34d', text: '#78350f' },
  { color: '#fce7f3', border: '#f9a8d4', text: '#831843' },
  { color: '#fee2e2', border: '#fca5a5', text: '#7f1d1d' },
]
const NEW_LABELS = [
  'Звонок · ученик', 'Урок React', 'Консультация', 'Дедлайн проекта',
  'Тест по TypeScript', 'Разбор ошибок', 'Проверка ДЗ',
]
const STEP_PX = 34   // px per hour slot

interface CalEvent {
  id: number; day: number; top: number; h: number
  label: string; color: string; border: string; text: string
}

let nextId = 10

function CalendarMockup() {
  const days  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const dates = [25, 26, 27, 28, 29, 30, 31]
  const TIMES = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00']

  const [events, setEvents] = useState<CalEvent[]>([
    { id: 1, day: 1, top: 28,  h: 32, label: 'Звонок · React Flow', ...PALETTE[0] },
    { id: 2, day: 1, top: 74,  h: 32, label: 'Лекция: JSX',         ...PALETTE[1] },
    { id: 3, day: 2, top: 62,  h: 32, label: 'Дедлайн TODO',         ...PALETTE[4] },
    { id: 4, day: 3, top: 96,  h: 32, label: 'Тест по хукам',        ...PALETTE[2] },
    { id: 5, day: 5, top: 46,  h: 32, label: 'Доклад · CSS',         ...PALETTE[3] },
  ])

  const dragRef = useRef<{
    id: number; startY: number; startTop: number; startDay: number
    colWidth: number; startX: number
  } | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)

  // Create event by clicking on empty body area
  const handleBodyClick = useCallback((dayIdx: number, e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore if we just finished a drag
    if (dragRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const pal  = PALETTE[nextId % PALETTE.length]
    const label = NEW_LABELS[nextId % NEW_LABELS.length]
    const top   = Math.round(relY / STEP_PX) * STEP_PX
    setEvents(prev => [...prev, { id: nextId++, day: dayIdx, top, h: 32, label, ...pal }])
  }, [])

  // Start dragging
  const startDrag = useCallback((id: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const ev = events.find(x => x.id === id)
    if (!ev) return
    const colWidth = gridRef.current ? gridRef.current.clientWidth / 7 : 60
    dragRef.current = { id, startY: e.clientY, startTop: ev.top, startDay: ev.day, colWidth, startX: e.clientX }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [events])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { id, startY, startTop, startDay, colWidth, startX } = dragRef.current
    const dy  = e.clientY - startY
    const dx  = e.clientX - startX
    const newTop = Math.max(0, Math.round((startTop + dy) / STEP_PX) * STEP_PX)
    const dayDelta = Math.round(dx / colWidth)
    const newDay  = Math.max(0, Math.min(6, startDay + dayDelta))
    setEvents(prev => prev.map(ev =>
      ev.id === id ? { ...ev, top: newTop, day: newDay } : ev
    ))
  }, [])

  const onDragEnd = useCallback(() => { dragRef.current = null }, [])

  const addRandom = useCallback(() => {
    const pal  = PALETTE[nextId % PALETTE.length]
    const label = NEW_LABELS[nextId % NEW_LABELS.length]
    const day  = Math.floor(Math.random() * 7)
    const top  = Math.round(Math.random() * 5) * STEP_PX + 14
    setEvents(prev => [...prev, { id: nextId++, day, top, h: 32, label, ...pal }])
  }, [])

  return (
    <div className={s.cal_mockup} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
      <div className={s.cal_header}>
        <span className={s.cal_month}>Май 2026 ▾</span>
        <button className={s.btn_red_sm} onClick={addRandom}>+ Запись</button>
      </div>

      <div style={{
        fontSize: 10, color: '#b4b4be', padding: '0 8px 6px',
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em',
      }}>
        клик на пустое место — создать · перетащить — переместить
      </div>

      <div className={s.cal_grid}>
        <div className={s.cal_time_col}>
          {TIMES.map(h => (
            <div key={h} className={s.cal_time_label}>{h}</div>
          ))}
        </div>
        <div ref={gridRef} className={s.cal_days}>
          {days.map((d, i) => (
            <div key={d} className={s.cal_day_col}>
              <div className={s.cal_day_head}>
                <span className={s.cal_dow}>{d}</span>
                <span className={`${s.cal_date} ${i === 1 ? s.today : ''}`}>{dates[i]}</span>
              </div>
              <div
                className={s.cal_day_body}
                onClick={e => handleBodyClick(i, e)}
                style={{ cursor: 'crosshair' }}
              >
                {/* Grid lines */}
                {TIMES.map((_, hi) => (
                  <div key={hi} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: hi * STEP_PX + (STEP_PX / 2),
                    borderTop: '1px dashed #f0f0f4',
                    pointerEvents: 'none',
                  }} />
                ))}

                {events.filter(ev => ev.day === i).map(ev => (
                  <div
                    key={ev.id}
                    className={s.cal_event}
                    onPointerDown={e => startDrag(ev.id, e)}
                    style={{
                      top: ev.top, height: ev.h,
                      background: ev.color, borderLeft: `3px solid ${ev.border}`, color: ev.text,
                      cursor: 'grab', userSelect: 'none', touchAction: 'none',
                      transition: dragRef.current?.id === ev.id ? 'none' : 'top 0.12s, left 0.12s',
                    }}
                  >
                    {ev.label}
                  </div>
                ))}

                {i === 1 && <div className={s.now_line}><span className={s.now_dot} /></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Teachers Block ─────────────────────────────────────────────
const TEACHERS = [
  { name: 'Мария Соколова', spec: 'CSS · Дизайн-системы', rating: '5.0', students: '2310', hue: 278, rank: 1 },
  { name: 'Анна Петрова', spec: 'React · TypeScript', rating: '4.9', students: '1849', hue: 205, rank: 2 },
  { name: 'Елена Иванова', spec: 'UX · Продукт', rating: '4.8', students: '1640', hue: 18, rank: 3 },
]
const TABLE_TEACHERS = [
  { name: 'Дмитрий Козлов', spec: 'Next.js · Backend', rating: '4.8', students: 1328, growth: 196, n: 4 },
  { name: 'Игорь Волков', spec: 'Node.js · Postgres', rating: '4.7', students: 1184, growth: 28, n: 5 },
  { name: 'Наталья Белова', spec: 'Python · ML', rating: '4.7', students: 1102, growth: 142, n: 6 },
  { name: 'Сергей Орлов', spec: 'Go · Системы', rating: '4.6', students: 980, growth: 88, n: 7 },
]

function Sparkline({ data }: { data: number[] }) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const w = 80, h = 28
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 4 - ((v - min) / span) * (h - 8),
  ])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={RED} />
    </svg>
  )
}

function TeachersBlock() {
  return (
    <div>
      <div className={s.teachers_head}>
        <div>
          <h2 className={s.section_h2} style={{ marginBottom: 6 }}>
            Учителя на <span style={{ color: RED }}>платформе</span>
          </h2>
          <div className={s.teachers_sub}>Рейтинг по количеству учеников · май 2026</div>
        </div>
        <Link href="/posts/teachers" className={s.link_red}>Все 42 →</Link>
      </div>

      <div className={s.teachers_grid}>
        {/* Podium */}
        <div className={s.podium}>
          {TEACHERS.sort((a, b) => {
            const order = [2, 1, 3]
            return order.indexOf(a.rank) - order.indexOf(b.rank)
          }).map(t => (
            <div key={t.name} className={s.podium_col}>
              {t.rank === 1 && (
                <svg width="28" height="20" viewBox="0 0 24 24" fill={RED} style={{ marginBottom: 6 }}>
                  <path d="M3 7l4 4 5-7 5 7 4-4v11H3z" />
                </svg>
              )}
              <div className={s.podium_avatar} style={{
                width: t.rank === 1 ? 88 : 72, height: t.rank === 1 ? 88 : 72,
                background: `linear-gradient(140deg, hsl(${t.hue} 60% 62%), hsl(${t.hue + 35} 62% 42%))`,
                boxShadow: t.rank === 1 ? `0 0 0 3px ${RED}, 0 0 0 6px #fff` : 'none',
              }}>
                {t.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                <span className={s.rank_badge} style={{ background: t.rank === 1 ? RED : '#0e0e12' }}>{t.rank}</span>
              </div>
              <div className={s.podium_name}>{t.name}</div>
              <div className={s.podium_spec}>{t.spec}</div>
              <div className={s.podium_stats}>
                <span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={RED}><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
                  {t.rating}
                </span>
                <span>{t.students} уч.</span>
              </div>
              <div className={s.podium_base} style={{
                height: t.rank === 1 ? 56 : t.rank === 2 ? 38 : 26,
                borderTop: `3px solid ${t.rank === 1 ? RED : '#d8d8e0'}`,
                background: t.rank === 1 ? `rgba(237,6,6,0.08)` : '#f1f1f5',
              }} />
            </div>
          ))}
        </div>

        {/* Table */}
        <div className={s.teachers_table_wrap}>
          <div className={s.teachers_table}>
            <div className={s.table_head}>
              <span>Учитель</span><span>Специальность</span><span>Рейтинг</span><span>Ученики</span>
              <span style={{ textAlign: 'right' }}>Динамика</span>
            </div>
            {TABLE_TEACHERS.map((t, i) => (
              <div key={t.name} className={s.table_row} style={{ borderBottom: i < TABLE_TEACHERS.length - 1 ? '1px solid #f3f3f7' : 'none' }}>
                <span className={s.table_teacher}>
                  <span className={s.table_n}>{t.n}</span>
                  <Avatar name={t.name} size={34} />
                  <span className={s.table_tname}>{t.name}</span>
                </span>
                <span className={s.table_spec}>{t.spec}</span>
                <span className={s.table_rating}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={RED}><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
                  {t.rating}
                </span>
                <span className={s.table_students}>{t.students.toLocaleString('ru')}</span>
                <span className={s.table_spark}>
                  <Sparkline data={[3, 4, 5, 6, 5, 7, 8].map((v, j) => v + j * i * 0.3)} />
                  <span style={{ color: RED, fontSize: 12, fontWeight: 600 }}>+{t.growth}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PDF Promo ──────────────────────────────────────────────────
function PdfTestPromo() {
  return (
    <div className={s.section_grid}>
      <div style={{ minWidth: 0 }}>
        <PdfParticleAnim />
      </div>
      <div>
        <div className={s.eyebrow}>Новый инструмент</div>
        <h2 className={s.section_h2}>
          PDF превращается в <span style={{ color: RED }}>электронный тест</span>
        </h2>
        <p className={s.section_text}>
          Загрузите PDF с вопросами и ответами — сервис распознаёт структуру и собирает интерактивный тест: выбор вариантов, сопоставление пар, ввод ответа. Ученики проходят онлайн, результаты считаются автоматически.
        </p>
        <div className={s.tag_row}>
          {['выбор вариантов', 'пары', 'ввод ответа', 'авто-проверка'].map(t => (
            <span key={t} className={s.tag_chip}>{t}</span>
          ))}
        </div>
        <Link href="/profile" className={s.btn_red}>
          Открыть конструктор тестов
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 5l7 7-7 7" /></svg>
        </Link>
      </div>
    </div>
  )
}

// ─── Features Block ─────────────────────────────────────────────
const FEATURES = [
  {
    badge: 'AI · АКТИВНО', badgeColor: '#1f8a4c',
    title: 'Авто-поиск ошибок',
    desc: 'AI читает работу студента в реальном времени и подсвечивает ошибки — с примером исправления.',
    kind: 'ico' as const,
    accent: '#ff7a3d',
  },
  {
    badge: 'AI · BETA', badgeColor: RED,
    title: 'Тесты из материала',
    desc: 'Загрузите лекцию, PDF или текст урока — платформа сгенерирует 10 разноформатных вопросов.',
    kind: 'cube' as const,
    accent: RED,
  },
  {
    badge: 'СКОРО · Q3 2026', badgeColor: '#7c3aed',
    title: 'Заработок и авто-оплата',
    desc: 'Подключите карту — продавайте курсы и получайте оплату автоматически. Комиссия всего 5%.',
    kind: 'torus' as const,
    accent: '#7c3aed',
  },
]

function FeaturesBlock() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div className={s.eyebrow}>Дорожная карта</div>
        <h2 className={s.section_h2}>
          Что нового — <span style={{ color: RED }}>и что скоро</span>
        </h2>
      </div>
      <div className={s.features_grid}>
        {FEATURES.map(f => (
          <div key={f.title} className={s.feature_card}>
            <div className={s.feature_shape}>
              <ThreeShape kind={f.kind} accent={f.accent} size={120} />
            </div>
            <span className={s.feature_badge} style={{ color: f.badgeColor, background: `${f.badgeColor}18` }}>{f.badge}</span>
            <div className={s.feature_title}>{f.title}</div>
            <p className={s.feature_desc}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Learning Cycle ─────────────────────────────────────────────
function CourseCycle() {
  return (
    <div className={s.cycle_wrap}>
      <span className={s.cycle_or}>ИЛИ</span>
      <h3 className={s.cycle_h3}>
        проходите курсы — <span style={{ color: RED }}>получайте новые</span> и закрепляйте старые знания
      </h3>
      <div className={s.cycle_steps}>
        {[
          { label: 'Новое', sub: 'осваиваете тему', icon: <path d="M12 3v18M5 10l7-7 7 7" /> },
          { label: 'Практика', sub: 'решаете задания', icon: <><path d="M4 7h16M4 12h10M4 17h13" /></> },
          { label: 'Повторение', sub: 'закрепляете в памяти', icon: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></> },
        ].map(({ label, sub, icon }, i, arr) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div className={s.cycle_step}>
              <span className={s.cycle_icon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              </span>
              <div className={s.cycle_label}>{label}</div>
              <div className={s.cycle_sub}>{sub}</div>
            </div>
            {i < arr.length - 1 && (
              <svg width="56" height="16" viewBox="0 0 56 16" fill="none" stroke="#d8a0a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 28, flexShrink: 0 }}>
                <path d="M2 8h46" /><path d="M40 3l8 5-8 5" />
              </svg>
            )}
          </div>
        ))}
        <svg width="56" height="36" viewBox="0 0 56 36" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 18, flexShrink: 0 }}>
          <path d="M6 10a22 22 0 0 1 44 0v10a22 22 0 0 1-44 0" />
          <path d="M1 14l5-6 6 5" />
        </svg>
      </div>
      <div className={s.cycle_caption}>непрерывный цикл знаний</div>
    </div>
  )
}

// ─── Posts Slider ───────────────────────────────────────────────
interface RealPost {
  id: string; title: string; createdAt: string
  teacher: { name: string; avatarUrl: string | null }
  category: { translations: { langCode: string; name: string }[] } | null
  viewCount: number; avgRating: number
  _count: { comments: number }
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (d < 60)  return `${d}м назад`
  if (d < 1440) return `${Math.floor(d/60)}ч назад`
  return `${Math.floor(d/1440)}д назад`
}

function PostCard({ post }: { post: RealPost }) {
  const cat = post.category?.translations.find(t => t.langCode === 'ru')?.name
    ?? post.category?.translations[0]?.name ?? 'Пост'
  return (
    <div className={s.post_card}>
      <div className={s.post_head}>
        <Avatar name={post.teacher.name} size={42} />
        <div>
          <div className={s.post_author}>{post.teacher.name}</div>
          <div className={s.post_meta}>{timeAgo(post.createdAt)} · <span style={{ color: RED }}>Учитель</span></div>
        </div>
      </div>
      <div className={s.post_cat}>{cat}</div>
      <div className={s.post_title}>{post.title}</div>
      <div className={s.post_foot}>
        <span className={s.post_stat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b4b4be" strokeWidth="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-12 7.5L3 21l2-6a8.4 8.4 0 1 1 16-3.5z" /></svg>
          {post._count.comments}
        </span>
        <span className={s.post_stat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b4b4be" strokeWidth="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          {post.viewCount >= 1000 ? `${(post.viewCount/1000).toFixed(1)}k` : post.viewCount}
        </span>
        {post.avgRating > 0 && (
          <span className={s.post_rating}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={RED}><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
            {post.avgRating.toFixed(1)}
          </span>
        )}
      </div>
      <Link href={`/posts/${post.id}`} className={s.post_btn}>Читать полностью →</Link>
    </div>
  )
}

function PostsSlider() {
  const ref = useRef<HTMLDivElement>(null)
  const [posts, setPosts] = useState<RealPost[]>([])
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 380, behavior: 'smooth' })

  useEffect(() => {
    fetch('/api/posts?limit=6&visibility=PUBLIC')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.posts?.length) setPosts(d.posts) })
      .catch(() => {})
  }, [])

  return (
    <div>
      <div className={s.posts_head}>
        <div>
          <div className={s.eyebrow}>Каталог постов</div>
          <h2 className={s.section_h2}>Лента <span style={{ color: RED }}>сообщества</span></h2>
        </div>
        <div className={s.posts_controls}>
          <Link href="/posts" className={s.link_red}>Все посты →</Link>
          <div className={s.slider_btns}>
            {([-1, 1] as const).map(d => (
              <button key={d} className={s.slider_btn} onClick={() => scroll(d)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: d < 0 ? 'scaleX(-1)' : 'none' }}>
                  <path d="M5 12h14" /><path d="M13 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div ref={ref} className={s.posts_slider}>
        {posts.length > 0
          ? posts.map(p => <PostCard key={p.id} post={p} />)
          : Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={s.post_card} style={{ background: '#f7f7fa', border: 'none' }}>
                <div style={{ height: 42, background: '#ececf2', borderRadius: 8 }} />
                <div style={{ height: 14, background: '#ececf2', borderRadius: 6, marginTop: 16, width: '60%' }} />
                <div style={{ height: 18, background: '#e4e4ea', borderRadius: 6, marginTop: 10, width: '85%' }} />
              </div>
            )
          )
        }
      </div>
    </div>
  )
}

// ─── Divider ────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: '#ececf2' }} />
}

// ─── Page ───────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className={s.page}>
      <div className={s.container}>
        <HeroSection />
        <Divider />
        <VideoSection />
        <Divider />
        <CourseSection />
        <CourseCycle />
        <Divider />
        <FeaturesBlock />
        <Divider />
        <CalendarSection />
        <Divider />
        <TeachersBlock />
        <Divider />
        <PdfTestPromo />
        <Divider />
        <PostsSlider />
      </div>
    </div>
  )
}
