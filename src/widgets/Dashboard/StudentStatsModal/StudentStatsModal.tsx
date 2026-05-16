'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Pie, PieChart, Sector,
} from 'recharts'
import styles from './StudentStatsModal.module.scss'

interface CategoryStat {
  id: string
  name: string
  count: number
  color: string
}

interface WeeklyCount {
  week: string
  count: number
}

interface WeeklyScore {
  week: string
  avgScore: number | null
  count: number
}

interface StatsData {
  totalErrors: number
  totalAttempts: number
  totalPostViews: number
  totalRoadmaps: number
  totalCalls: number
  avgScore: number | null
  errorsByCategory: CategoryStat[]
  errorsOverTime: WeeklyCount[]
  attemptsOverTime: WeeklyScore[]
  postsOverTime: WeeklyCount[]
  roadmapsOverTime: WeeklyCount[]
  callsOverTime: WeeklyCount[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActivePieShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={outerRadius + 7}
        startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={3} />
    </g>
  )
}

interface ActivityChartProps {
  title: string
  data: WeeklyCount[]
  unit: string
  emptyText: string
}

function ActivityChart({ title, data, unit, emptyText }: ActivityChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const hasData = data.some(w => w.count > 0)
  const maxVal = hasData ? Math.max(...data.map(d => d.count)) : 0

  function barColor(entry: WeeklyCount, idx: number) {
    if (entry.count === 0) return '#EFEFEF'
    if (hoveredIdx !== null) {
      if (idx === hoveredIdx) return '#111118'
      return entry.count === maxVal ? '#999' : '#DEDEDE'
    }
    return entry.count === maxVal ? '#111118' : '#D4D4D4'
  }

  return (
    <div className={styles.chartCard}>
      {title && <div className={styles.chartTitle}>{title}</div>}
      {!hasData ? (
        <div className={styles.chartEmpty}>{emptyText}</div>
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="30%" onMouseLeave={() => setHoveredIdx(null)}>
              <CartesianGrid vertical={false} stroke="#F5F5F5" strokeDasharray="0" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#BBBBC8' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#BBBBC8' }} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || payload[0]?.value == null) return null
                  return (
                    <div className={styles.tooltip}>
                      <div className={styles.tooltipLabel}>{label}</div>
                      <div className={styles.tooltipVal}>{payload[0].value} {unit}</div>
                    </div>
                  )
                }}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}
                onMouseEnter={(_: unknown, idx: number) => setHoveredIdx(idx)}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry, i)} style={{ transition: 'fill 0.12s ease' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryValue}>{value}</div>
      <div className={styles.summaryLabel}>{label}</div>
    </div>
  )
}

export function StudentStatsModal({ isOpen, onClose }: Props) {
  const t = useTranslations('studentStats')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activePie, setActivePie] = useState<number | null>(null)

  useEffect(() => {
    if (!isOpen || data) return
    setLoading(true)
    fetch('/api/student/stats')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen, data])

  if (!isOpen) return null

  const pieData = (data?.errorsByCategory ?? []).map(c => ({ name: c.name, value: c.count, color: c.color }))
  const totalCatErrors = pieData.reduce((s, d) => s + d.value, 0)
  const centerCat = activePie !== null ? pieData[activePie] : null

  const hasScores = (data?.attemptsOverTime ?? []).some(w => w.avgScore != null)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h2 className={styles.title}>{t('title')}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.empty}>{t('loading')}</div>
          ) : !data ? (
            <div className={styles.empty}>{t('noData')}</div>
          ) : (
            <>
              {/* Summary 2×3 */}
              <div className={styles.summaryGrid}>
                <SummaryCard value={data.totalPostViews}  label={t('postsRead')} />
                <SummaryCard value={data.totalRoadmaps}   label={t('roadmaps')} />
                <SummaryCard value={data.totalCalls}      label={t('videoCalls')} />
                <SummaryCard value={data.totalAttempts}   label={t('testsPassed')} />
                <SummaryCard value={data.avgScore != null ? `${data.avgScore}%` : '—'} label={t('avgScore')} />
                <SummaryCard value={data.totalErrors}     label={t('errors')} />
              </div>

              {/* Activity charts 2×2 */}
              <div className={styles.sectionTitle}>{t('activityByWeek')}</div>
              <div className={styles.chartsGrid}>
                <ActivityChart title={t('chartPosts')}    data={data.postsOverTime}    unit={t('unitPosts')}   emptyText={t('emptyPosts')} />
                <ActivityChart title={t('chartRoadmaps')} data={data.roadmapsOverTime} unit={t('unitRoadmaps')} emptyText={t('emptyRoadmaps')} />
                <ActivityChart title={t('chartCalls')}    data={data.callsOverTime}    unit={t('unitCalls')}   emptyText={t('emptyCalls')} />

                {/* Test scores */}
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>{t('chartTests')}</div>
                  {!hasScores ? (
                    <div className={styles.chartEmpty}>{t('emptyTests')}</div>
                  ) : (
                    <div className={styles.chartWrap}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.attemptsOverTime} barCategoryGap="30%">
                          <CartesianGrid vertical={false} stroke="#F5F5F5" strokeDasharray="0" />
                          <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#BBBBC8' }} axisLine={false} tickLine={false} interval={2} />
                          <YAxis tick={{ fontSize: 10, fill: '#BBBBC8' }} axisLine={false} tickLine={false} width={28} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length || payload[0]?.value == null) return null
                              const entry = (payload[0] as { payload?: WeeklyScore }).payload
                              return (
                                <div className={styles.tooltip}>
                                  <div className={styles.tooltipLabel}>{label}</div>
                                  <div className={styles.tooltipVal}>{payload[0].value}% · {entry?.count ?? 0} {t('unitCalls')}</div>
                                </div>
                              )
                            }}
                            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                          />
                          <Bar dataKey="avgScore" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}>
                            {data.attemptsOverTime.map((entry, i) => (
                              <Cell key={i} fill={
                                entry.avgScore == null ? '#EFEFEF'
                                  : entry.avgScore >= 75 ? '#111118'
                                    : entry.avgScore >= 50 ? '#888888'
                                      : '#CCCCCC'
                              } style={{ transition: 'fill 0.12s ease' }} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Errors over time */}
              <div className={styles.sectionTitle}>{t('errorsByWeek')}</div>
              <ActivityChart title="" data={data.errorsOverTime} unit={t('unitErrors')} emptyText={t('emptyErrors')} />

              {/* Error categories */}
              {data.errorsByCategory.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>{t('topErrorTopics')}</div>
                  <div className={styles.categoriesCard}>
                    <div className={styles.categoriesRow}>
                      <div className={styles.pieWrap}>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%" cy="50%"
                              innerRadius={50} outerRadius={76}
                              dataKey="value"
                              strokeWidth={0}
                              animationBegin={0} animationDuration={800}
                              activeShape={<ActivePieShape />}
                              onMouseEnter={(_, idx) => setActivePie(idx)}
                              onMouseLeave={() => setActivePie(null)}
                            >
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color}
                                  opacity={activePie !== null && activePie !== i ? 0.35 : 1}
                                  style={{ cursor: 'pointer', transition: 'opacity .2s' }} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className={styles.pieCenter}>
                          {centerCat ? (
                            <>
                              <span className={styles.pieCenterNum} style={{ color: pieData[activePie!]?.color }}>{centerCat.value}</span>
                              <span className={styles.pieCenterSub}>{centerCat.name}</span>
                            </>
                          ) : (
                            <>
                              <span className={styles.pieCenterNum}>{totalCatErrors}</span>
                              <span className={styles.pieCenterSub}>{t('errors')}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className={styles.catLegend}>
                        {data.errorsByCategory.map((c, i) => {
                          const pct = totalCatErrors > 0 ? Math.round((c.count / totalCatErrors) * 100) : 0
                          const maxCount = data.errorsByCategory[0]?.count ?? 1
                          return (
                            <div key={c.id}
                              className={`${styles.catRow} ${activePie === i ? styles.catRowActive : ''}`}
                              onMouseEnter={() => setActivePie(i)}
                              onMouseLeave={() => setActivePie(null)}
                            >
                              <span className={styles.catDot} style={{ background: c.color }} />
                              <div className={styles.catInfo}>
                                <div className={styles.catTop}>
                                  <span className={styles.catName}>{c.name}</span>
                                  <span className={styles.catCount}>{c.count}×</span>
                                  <span className={styles.catPct}>{pct}%</span>
                                </div>
                                <div className={styles.catTrack}>
                                  <div className={styles.catFill} style={{ width: `${(c.count / maxCount) * 100}%`, background: c.color }} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
