'use client'
import {useEffect, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import styles from './StatsHero.module.scss'
import {StatsHeroModalContent} from './StatsHeroModalContent/StatsHeroModalContent'

interface HeroStats {
  newStudentsThisMonth: number
  newStudentsPrevMonth: number
  completedStudentsCount: number
  activeProgressCount: number
  totalStudents: number
  totalProgress: number
}

interface StatsHeroProps {
  students?: number
  roadmaps?: number
  totalLessons?: number
  totalHours?: number
  heroStats?: HeroStats
  extraClass?: string
}

function Modal({isOpen, onClose, detailedStatsLabel}: {isOpen: boolean; onClose: () => void; detailedStatsLabel: string}) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return (
    <div
      ref={backdropRef}
      className={`${styles.backdrop} ${isOpen ? styles.backdrop_open : ''}`}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
    >
      <div className={styles.modal} role='dialog' aria-modal>
        <div className={styles.modal_header}>
          <span className={styles.modal_title}>{detailedStatsLabel}</span>
          <button className={styles.modal_close} onClick={onClose} aria-label='Закрыть'>
            ×
          </button>
        </div>
        <StatsHeroModalContent />
      </div>
    </div>
  )
}

export function StatsHero({students = 0, roadmaps = 0, totalLessons = 0, totalHours = 0, heroStats, extraClass}: StatsHeroProps) {
  const t = useTranslations('statsPage.hero')
  const [animated, setAnimated] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const anim = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(anim)
  }, [])

  const h = heroStats
  const totalStudents = Math.max(h?.totalStudents ?? 1, 1)
  const totalProgress = Math.max(h?.totalProgress ?? 1, 1)

  const bars = h
    ? [
        {
          label: t('barNewStudents'),
          value: Math.min(100, Math.round(((h.newStudentsThisMonth) / totalStudents) * 100)),
          trend: h.newStudentsThisMonth >= h.newStudentsPrevMonth
            ? t('trendThisMonth', {n: h.newStudentsThisMonth - h.newStudentsPrevMonth})
            : t('trendNegThisMonth', {n: h.newStudentsPrevMonth - h.newStudentsThisMonth}),
        },
        {
          label: t('barPassedCourse'),
          value: Math.min(100, Math.round((h.completedStudentsCount / totalStudents) * 100)),
          trend: t('trendCompleted', {n: h.completedStudentsCount}),
        },
        {
          label: t('barActiveRoadmap'),
          value: Math.min(100, Math.round((h.activeProgressCount / totalProgress) * 100)),
          trend: t('trendActive', {n: h.activeProgressCount}),
        },
      ]
    : [
        {label: t('barNewStudents'), value: 0, trend: '—'},
        {label: t('barPassedCourse'), value: 0, trend: '—'},
        {label: t('barActiveRoadmap'), value: 0, trend: '—'},
      ]

  const metrics = [
    {num: students, label: t('students')},
    {num: roadmaps, label: t('roadmap')},
    {num: totalLessons, label: t('lessons')},
    {num: totalHours, label: t('hours')},
  ]

  return (
    <>
      <div className={`${styles.hero} ${extraClass ?? ''}`}>
        <div className={styles.bars}>
          {bars.map((b) => (
            <div key={b.label} className={styles.bar_item}>
              <p className={styles.bar_label}>{b.label}</p>
              <div className={styles.bar_track}>
                <div className={styles.bar_fill} style={{width: animated ? `${b.value}%` : '0%'}} />
              </div>
              <div className={styles.bar_footer}>
                <span className={styles.bar_val}>{b.value}%</span>
                <span className={styles.bar_dot} />
                <span className={styles.bar_trend}>{b.trend}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.metrics}>
          {metrics.map((m, i) => (
            <>
              {i > 0 && <div key={`sep-${i}`} className={styles.metric_sep} />}
              <div key={m.label} className={styles.metric}>
                <span
                  className={`${styles.metric_num} ${animated ? styles.metric_num_visible : ''}`}
                  style={{transitionDelay: `${i * 0.1}s`}}
                >
                  {m.num}
                </span>
                <span className={styles.metric_label}>{m.label}</span>
              </div>
            </>
          ))}
        </div>

        <button className={styles.more_btn} onClick={() => setModalOpen(true)}>
          {t('more')}
          <svg viewBox='0 0 10 10' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <path
              d='M2 5h6M5.5 2.5 8 5l-2.5 2.5'
              stroke='currentColor'
              strokeWidth='1.2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} detailedStatsLabel={t('detailedStats')} />
    </>
  )
}
