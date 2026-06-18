'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRef } from 'react'
import TypingText from './TypingText'
import s from './LandingPage.module.scss'

const KnowledgeGlobe = dynamic(() => import('./KnowledgeGlobe'), { ssr: false })

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
function FeedTile({ name, hue, speaking, muted, floating, style }: {
  name: string; hue: number; speaking?: boolean; muted?: boolean; floating?: boolean; style?: React.CSSProperties
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
    </div>
  )
}

function VideoSection() {
  return (
    <div className={s.section_grid}>
      <div className={s.video_wrap}>
        <FeedTile name="Анна Петрова" hue={258} speaking style={{ aspectRatio: '16/10', width: '100%' }} />
        <div className={s.rec_badge}>
          <span className={s.pulse_dot} style={{ background: RED }} />
          Запись урока
        </div>
        <div className={s.video_thumbs}>
          <FeedTile name="Иван" hue={210} floating muted style={{ width: 120, aspectRatio: '4/3' }} />
          <FeedTile name="Мария" hue={12} floating style={{ width: 120, aspectRatio: '4/3' }} />
        </div>
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
  )
}

// ─── Course Section ─────────────────────────────────────────────
function CourseSection() {
  return (
    <div className={s.section_grid} style={{ direction: 'ltr' }}>
      <div className={s.course_preview}>
        <CourseMockup />
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

function CalendarMockup() {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const dates = [25, 26, 27, 28, 29, 30, 31]
  const events = [
    { day: 1, top: 28, h: 28, label: 'Звонок · React Flow', color: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
    { day: 1, top: 68, h: 28, label: 'Лекция: JSX', color: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e' },
    { day: 2, top: 68, h: 28, label: 'Дедлайн TODO', color: '#fce7f3', border: '#f9a8d4', text: '#831843' },
    { day: 3, top: 100, h: 28, label: 'Тест по хукам', color: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
    { day: 5, top: 48, h: 28, label: 'Доклад · CSS', color: '#fef3c7', border: '#fcd34d', text: '#78350f' },
  ]
  return (
    <div className={s.cal_mockup}>
      <div className={s.cal_header}>
        <span className={s.cal_month}>Май 2026 ▾</span>
        <button className={s.btn_red_sm}>+ Запись</button>
      </div>
      <div className={s.cal_grid}>
        <div className={s.cal_time_col}>
          {['9:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map(h => (
            <div key={h} className={s.cal_time_label}>{h}</div>
          ))}
        </div>
        <div className={s.cal_days}>
          {days.map((d, i) => (
            <div key={d} className={s.cal_day_col}>
              <div className={s.cal_day_head}>
                <span className={s.cal_dow}>{d}</span>
                <span className={`${s.cal_date} ${i === 1 ? s.today : ''}`}>{dates[i]}</span>
              </div>
              <div className={s.cal_day_body}>
                {events.filter(e => e.day === i).map((e, j) => (
                  <div key={j} className={s.cal_event}
                    style={{ top: e.top, height: e.h, background: e.color, borderLeft: `3px solid ${e.border}`, color: e.text }}>
                    {e.label}
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
      <div className={s.pdf_visual}>
        <div className={s.pdf_doc}>
          <span className={s.pdf_tag}>PDF</span>
          {[80, 100, 70, 100, 55].map((w, i) => (
            <div key={i} className={s.pdf_line} style={{ width: `${w}%`, marginTop: i ? 10 : 16 }} />
          ))}
        </div>
        <svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h32" /><path d="M26 4l9 8-9 8" />
        </svg>
        <div className={s.test_doc}>
          <div className={s.test_doc_title} />
          {[0, 1, 2].map(i => (
            <div key={i} className={s.test_option}>
              <span className={s.test_radio} style={{ borderColor: i === 1 ? RED : '#d8d8e0', background: i === 1 ? RED : '#fff' }}>
                {i === 1 && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
              </span>
              <div className={s.test_option_line} />
            </div>
          ))}
        </div>
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
const MOCK_POSTS = [
  { author: 'Дмитрий Козлов', role: 'Преподаватель', when: '2д назад', cat: 'React Flow', title: 'Графы знаний на практике', sub: 'Связываем темы курса в наглядную схему.', comments: 86, views: '22k', rating: '4.8' },
  { author: 'Игорь Волков', role: 'Автор', when: '5д назад', cat: 'TypeScript', title: 'Тесты из PDF за минуту', sub: 'Загрузил файл — получил готовый тренажёр.', comments: 152, views: '51k', rating: '5.0' },
  { author: 'Наталья Белова', role: 'Преподаватель', when: '6д назад', cat: 'ML', title: 'ML для новичков: с чего начать', sub: 'Дорожная карта без лишней математики.', comments: 73, views: '27k', rating: '4.7' },
  { author: 'Елена Иванова', role: 'Автор', when: '1нед назад', cat: 'Продуктивность', title: 'Как удержать фокус на учёбе', sub: 'Простые приёмы работать умнее.', comments: 120, views: '40k', rating: '4.9' },
]

function PostCard({ post }: { post: typeof MOCK_POSTS[0] }) {
  return (
    <div className={s.post_card}>
      <div className={s.post_head}>
        <Avatar name={post.author} size={42} />
        <div>
          <div className={s.post_author}>{post.author}</div>
          <div className={s.post_meta}>{post.when} · <span style={{ color: RED }}>{post.role}</span></div>
        </div>
      </div>
      <div className={s.post_cat}>{post.cat}</div>
      <div className={s.post_title}>{post.title}</div>
      <div className={s.post_sub}>{post.sub}</div>
      <div className={s.post_foot}>
        <span className={s.post_stat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b4b4be" strokeWidth="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-12 7.5L3 21l2-6a8.4 8.4 0 1 1 16-3.5z" /></svg>
          {post.comments}
        </span>
        <span className={s.post_stat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b4b4be" strokeWidth="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          {post.views}
        </span>
        <span className={s.post_rating}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={RED}><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
          {post.rating}
        </span>
      </div>
      <Link href="/posts" className={s.post_btn}>Читать полностью →</Link>
    </div>
  )
}

function PostsSlider() {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 380, behavior: 'smooth' })

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
        {MOCK_POSTS.map((p, i) => <PostCard key={i} post={p} />)}
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
