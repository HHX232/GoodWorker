'use client'
import {useMemo, useState} from 'react'
import {Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
import ModalWindowDefault from '../../Modals/ModalWindowDefault/ModalWindowDefault'
import styles from './HoursChart.module.scss'

const monthsData: Record<string, {day: string; hours: number}[]> = {
  Январь: Array.from({length: 31}, (_, i) => ({day: String(i + 1), hours: Math.round(Math.random() * 6 * 10) / 10})),
  Февраль: Array.from({length: 28}, (_, i) => ({day: String(i + 1), hours: Math.round(Math.random() * 6 * 10) / 10})),
  Март: Array.from({length: 31}, (_, i) => ({day: String(i + 1), hours: Math.round(Math.random() * 10 * 10) / 10})),
  Апрель: Array.from({length: 30}, (_, i) => ({day: String(i + 1), hours: Math.round(Math.random() * 5 * 10) / 10}))
}

const MONTHS = Object.keys(monthsData)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({active, payload, label}: any) => {
  if (active && payload?.length) {
    return (
      <div className={styles.tooltip}>
        <span className={styles.tooltip__day}>{label} число</span>
        <span className={styles.tooltip__val}>{payload[0].value} ч</span>
      </div>
    )
  }
  return null
}

function HoursChart({extraClass}: {extraClass?: string}) {
  const [selectedMonth, setSelectedMonth] = useState('Март')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const data = monthsData[selectedMonth]

  const totalHours = useMemo(() => data.reduce((s, d) => s + d.hours, 0).toFixed(1), [data])
  const maxDay = useMemo(() => data.reduce((a, b) => (a.hours > b.hours ? a : b)), [data])
  const avgHours = useMemo(() => (+totalHours / data.filter((d) => d.hours > 0).length).toFixed(1), [data, totalHours])
  const avg = useMemo(() => +totalHours / data.filter((d) => d.hours > 0).length, [data, totalHours])

  const getBarColor = (entry: {day: string; hours: number}, idx: number) => {
    if (hoveredIdx !== null) {
      if (idx === hoveredIdx) return '#1a1a1a'
      return entry.day === maxDay.day ? '#888' : '#e0e0e0'
    }
    return entry.day === maxDay.day ? '#1a1a1a' : '#d4d4d4'
  }

  return (
    <section className={`${styles.chart_card} ${extraClass ?? ''}`}>
      <ModalWindowDefault isOpen={false} onClose={() => {}}>
        <p></p>
      </ModalWindowDefault>
      <div className={styles.chart_header}>
        <div className={styles.chart_header__left}>
          <h3 className={styles.chart_title}>Часы занятий</h3>
          <p className={styles.chart_subtitle}>
            Итого за {selectedMonth}: <strong>{totalHours} ч</strong>
          </p>
        </div>

        <div className={styles.month_tabs}>
          {MONTHS.map((m, i) => (
            <button
              key={m}
              className={`${styles.month_tab} ${selectedMonth === m ? styles.month_tab_active : ''}`}
              style={{animationDelay: `${i * 40}ms`}}
              onClick={() => setSelectedMonth(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Stat chips вверху — анимированные */}
      <div className={styles.chart_chips}>
        <div className={styles.chip}>
          <span className={styles.chip_dot} style={{background: '#1a1a1a'}} />
          Пик: {maxDay.day} — <strong>{maxDay.hours} ч</strong>
        </div>
        <div className={styles.chip}>
          <span className={styles.chip_dot} style={{background: '#d4d4d4', border: '1px solid #bbb'}} />
          Среднее: <strong>{avgHours} ч/день</strong>
        </div>
        <div className={styles.chip}>
          <span className={styles.chip_dot} style={{background: '#888'}} />
          Дней с занятиями: <strong>{data.filter((d) => d.hours > 0).length}</strong>
        </div>
      </div>

      <div className={styles.chart_wrap}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={data} barCategoryGap='28%' onMouseLeave={() => setHoveredIdx(null)}>
            <CartesianGrid vertical={false} stroke='#f0f0f0' strokeDasharray='0' />
            {/* Линия среднего */}
            <ReferenceLine
              y={avg}
              stroke='#bbb'
              strokeDasharray='4 3'
              strokeWidth={1}
              label={{
                value: `avg`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#bbb',
                dy: -4
              }}
            />
            <XAxis dataKey='day' tick={{fontSize: 10, fill: '#bbb'}} axisLine={false} tickLine={false} interval={1} />
            <YAxis
              tick={{fontSize: 10, fill: '#bbb'}}
              axisLine={false}
              tickLine={false}
              width={26}
              tickFormatter={(v) => `${v}ч`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
            <Bar
              dataKey='hours'
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={600}
              animationEasing='ease-out'
              onMouseEnter={(_: unknown, idx: number) => setHoveredIdx(idx)}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry, index)} style={{transition: 'fill 0.15s ease'}} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default HoursChart
