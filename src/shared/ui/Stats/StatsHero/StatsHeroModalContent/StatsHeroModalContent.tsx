'use client'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import styles from './StatsHeroModalContent.module.scss'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiItem {
  value: string
  label: string
  delta: string
  up: boolean
}
interface MainPoint {
  m: string
  students: number
  rm: number
}
interface RevenuePoint {
  m: string
  v: number
}
interface RatingPoint {
  m: string
  v: number
}
interface CommentPoint {
  m: string
  c: number
  r: number
}

interface StatsHeroModalContentProps {
  kpis?: KpiItem[]
  mainData?: MainPoint[]
  revenueData?: RevenuePoint[]
  ratingData?: RatingPoint[]
  commentData?: CommentPoint[]
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_KPIS: KpiItem[] = [
  {value: '78', label: 'Учеников', delta: '+12 за месяц', up: true},
  {value: '56', label: 'Road-map', delta: '+8 активных', up: true},
  {value: '4.8', label: 'Рейтинг', delta: '+0.2', up: true},
  {value: '₽142к', label: 'Выручка', delta: '−3%', up: false}
]

const DEFAULT_MAIN: MainPoint[] = [
  {m: 'Янв', rm: 28, students: 42},
  {m: 'Фев', rm: 31, students: 48},
  {m: 'Мар', rm: 29, students: 51},
  {m: 'Апр', rm: 35, students: 55},
  {m: 'Май', rm: 38, students: 59},
  {m: 'Июн', rm: 44, students: 65},
  {m: 'Июл', rm: 50, students: 71},
  {m: 'Авг', rm: 56, students: 78}
]

const DEFAULT_REVENUE: RevenuePoint[] = [
  {m: 'Янв', v: 98},
  {m: 'Фев', v: 112},
  {m: 'Мар', v: 105},
  {m: 'Апр', v: 121},
  {m: 'Май', v: 134},
  {m: 'Июн', v: 128},
  {m: 'Июл', v: 148},
  {m: 'Авг', v: 142}
]

const DEFAULT_RATING: RatingPoint[] = [
  {m: 'Янв', v: 4.2},
  {m: 'Фев', v: 4.3},
  {m: 'Мар', v: 4.3},
  {m: 'Апр', v: 4.5},
  {m: 'Май', v: 4.5},
  {m: 'Июн', v: 4.6},
  {m: 'Июл', v: 4.7},
  {m: 'Авг', v: 4.8}
]

const DEFAULT_COMMENTS: CommentPoint[] = [
  {m: 'Янв', c: 14, r: 8},
  {m: 'Фев', c: 18, r: 11},
  {m: 'Мар', c: 22, r: 9},
  {m: 'Апр', c: 19, r: 14},
  {m: 'Май', c: 27, r: 16},
  {m: 'Июн', c: 31, r: 19},
  {m: 'Июл', c: 28, r: 22},
  {m: 'Авг', c: 35, r: 25}
]

// ─── Shared axis tick style ───────────────────────────────────────────────────

const TICK = {fontSize: 10, fill: '#ccc'} as const

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  format
}: {
  active?: boolean
  payload?: {name: string; value: number}[]
  label?: string
  format?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltip_label}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} className={styles.tooltip_row}>
          <span className={styles.tooltip_name}>{p.name}</span>
          <span className={styles.tooltip_val}>{format ? format(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatsHeroModalContent({
  kpis = DEFAULT_KPIS,
  mainData = DEFAULT_MAIN,
  revenueData = DEFAULT_REVENUE,
  ratingData = DEFAULT_RATING,
  commentData = DEFAULT_COMMENTS
}: StatsHeroModalContentProps) {
  return (
    <div className={styles.root}>
      <p className={styles.period}>Последние 8 месяцев</p>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className={styles.kpi_row}>
        {kpis.map((k, i) => (
          <div key={k.label} className={styles.kpi} style={{animationDelay: `${0.08 + i * 0.05}s`}}>
            <span className={styles.kpi_n}>{k.value}</span>
            <span className={styles.kpi_l}>{k.label}</span>
            <span className={`${styles.kpi_d} ${k.up ? styles.kpi_d_up : styles.kpi_d_dn}`}>
              {k.up ? '↑' : '↓'} {k.delta}
            </span>
          </div>
        ))}
      </div>

      {/* ── Main: students + road-map ─────────────────────────────────────── */}
      <section className={styles.section} style={{animationDelay: '0.28s'}}>
        <h3 className={styles.section_title}>Ученики и road-map по месяцам</h3>
        <div className={styles.chart_wrap}>
          <ResponsiveContainer width='100%' height={150}>
            <BarChart data={mainData} barGap={2} margin={{top: 4, right: 0, left: -28, bottom: 0}}>
              <CartesianGrid stroke='#f0f0f0' strokeDasharray='3 3' vertical={false} />
              <XAxis dataKey='m' tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
              <Bar dataKey='students' name='Ученики' fill='#1a1a1a' radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey='rm' name='Road-map' fill='#d4d4d4' radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Revenue — full width, taller ──────────────────────────────────── */}
      <section className={styles.section} style={{animationDelay: '0.36s'}}>
        <h3 className={styles.section_title}>Выручка, ₽тыс</h3>
        <div className={styles.chart_wrap}>
          <ResponsiveContainer width='100%' height={140}>
            <AreaChart data={revenueData} margin={{top: 4, right: 0, left: -28, bottom: 0}}>
              <defs>
                <linearGradient id='revGrad' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#1a1a1a' stopOpacity={0.1} />
                  <stop offset='100%' stopColor='#1a1a1a' stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke='#f0f0f0' strokeDasharray='3 3' vertical={false} />
              <XAxis dataKey='m' tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip
                content={<ChartTooltip format={(v) => `₽${v}к`} />}
                cursor={{stroke: 'rgba(0,0,0,0.06)', strokeWidth: 1}}
              />
              <Area
                dataKey='v'
                name='₽тыс'
                stroke='#1a1a1a'
                strokeWidth={1.5}
                fill='url(#revGrad)'
                dot={false}
                activeDot={{r: 4, fill: '#1a1a1a', strokeWidth: 0}}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Rating + Comments (two-col) ───────────────────────────────────── */}
      <div className={styles.two_col}>
        <section className={styles.section_flat} style={{animationDelay: '0.44s'}}>
          <h3 className={styles.section_title}>Рейтинг</h3>
          <div className={styles.chart_wrap}>
            <ResponsiveContainer width='100%' height={110}>
              <LineChart data={ratingData} margin={{top: 4, right: 0, left: -30, bottom: 0}}>
                <CartesianGrid stroke='#f0f0f0' strokeDasharray='3 3' vertical={false} />
                <XAxis dataKey='m' tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} domain={[4.0, 5.0]} />
                <ReferenceLine
                  y={4.5}
                  stroke='#e8e8e8'
                  strokeDasharray='4 4'
                  label={{value: 'avg', position: 'right', fontSize: 9, fill: '#ccc'}}
                />
                <Tooltip
                  content={<ChartTooltip format={(v) => v.toFixed(1)} />}
                  cursor={{stroke: 'rgba(0,0,0,0.06)', strokeWidth: 1}}
                />
                <Line
                  dataKey='v'
                  name='Рейтинг'
                  stroke='#1a1a1a'
                  strokeWidth={1.5}
                  dot={{r: 2.5, fill: '#fff', stroke: '#1a1a1a', strokeWidth: 1.5}}
                  activeDot={{r: 5, fill: '#1a1a1a', strokeWidth: 0}}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={styles.section_flat} style={{animationDelay: '0.5s'}}>
          <h3 className={styles.section_title}>Комментарии</h3>
          <div className={styles.chart_wrap}>
            <ResponsiveContainer width='100%' height={110}>
              <BarChart data={commentData} barGap={1} margin={{top: 4, right: 0, left: -30, bottom: 0}}>
                <CartesianGrid stroke='#f0f0f0' strokeDasharray='3 3' vertical={false} />
                <XAxis dataKey='m' tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
                <Bar dataKey='c' name='Комм.' fill='#1a1a1a' radius={[2, 2, 0, 0]} maxBarSize={12} />
                <Bar dataKey='r' name='Ответы' fill='#d4d4d4' radius={[2, 2, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}
