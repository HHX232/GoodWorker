'use client'
import {useCallback, useState} from 'react'
import {Cell, Pie, PieChart, ResponsiveContainer, Sector} from 'recharts'
import styles from './SubjectsPieChart.module.scss'

const data = [
  {name: 'Математика', hours: 10, color: '#1a1a1a'},
  {name: 'Физика', hours: 6, color: '#444444'},
  {name: 'Английский', hours: 5, color: '#787878'},
  {name: 'Химия', hours: 4, color: '#ababab'},
  {name: 'Русский', hours: 3, color: '#d4d4d4'}
]

const total = data.reduce((s, d) => s + d.hours, 0)

// Active sector shape — расширяет сектор при наведении
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ActiveShape = (props: any) => {
  const {cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill} = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 3}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={3}
      />
    </g>
  )
}

export function SubjectsPieChart({extraClass}: {extraClass?: string}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  // Что показываем в центре
  const displayIdx = selected ?? activeIdx
  const centerItem = displayIdx !== null ? data[displayIdx] : null

  const onPieEnter = useCallback((_: unknown, idx: number) => setActiveIdx(idx), [])
  const onPieLeave = useCallback(() => setActiveIdx(null), [])
  const onPieClick = useCallback((_: unknown, idx: number) => {
    setSelected((prev) => (prev === idx ? null : idx))
  }, [])

  const maxHours = Math.max(...data.map((d) => d.hours))

  return (
    <div className={`${styles.card} ${extraClass ?? ''}`}>
      <p className={styles.title}>Часы по предметам</p>

      {/* Pie */}
      <div className={styles.chart_wrap}>
        <ResponsiveContainer width='100%' height={170}>
          <PieChart>
            <Pie
              data={data}
              cx='50%'
              cy='50%'
              innerRadius={48}
              outerRadius={74}
              dataKey='hours'
              strokeWidth={0}
              animationBegin={0}
              animationDuration={900}
              //   activeIndex={activeIdx ?? undefined}
              activeShape={<ActiveShape />}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              onClick={onPieClick}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  opacity={displayIdx !== null && displayIdx !== i ? 0.35 : 1}
                  style={{cursor: 'pointer', transition: 'opacity .2s'}}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — анимируется через CSS transition */}
        <div className={styles.center_label}>
          {centerItem ? (
            <>
              <span className={`${styles.center_num} ${styles.center_num_active}`}>{centerItem.hours}</span>
              <span className={styles.center_sub}>{centerItem.name}</span>
            </>
          ) : (
            <>
              <span className={styles.center_num}>{total}</span>
              <span className={styles.center_sub}>часов</span>
            </>
          )}
        </div>
      </div>

      {/* Legend с прогресс-барами */}
      <div className={styles.legend}>
        {data.map((d, i) => {
          const pct = Math.round((d.hours / total) * 100)
          const isActive = displayIdx === i
          return (
            <div
              key={d.name}
              className={`${styles.legend__row} ${isActive ? styles.legend__row_active : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              onClick={() => setSelected((prev) => (prev === i ? null : i))}
            >
              <div className={styles.legend__top}>
                <div className={styles.legend__left}>
                  <span className={styles.legend__dot} style={{background: d.color}} />
                  <span className={styles.legend__name}>{d.name}</span>
                </div>
                <div className={styles.legend__right}>
                  <span className={styles.legend__pct}>{pct}%</span>
                  <span className={styles.legend__val}>{d.hours} ч</span>
                </div>
              </div>

              {/* Прогресс-бар */}
              <div className={styles.bar_track}>
                <div
                  className={styles.bar_fill}
                  style={{
                    width: `${(d.hours / maxHours) * 100}%`,
                    background: d.color,
                    // задержка по индексу — staggered анимация появления
                    animationDelay: `${i * 80}ms`
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
