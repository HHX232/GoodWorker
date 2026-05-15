'use client'
import {useEffect, useRef, useState} from 'react'
import styles from './StatsHero.module.scss'
import {StatsHeroModalContent} from './StatsHeroModalContent/StatsHeroModalContent'

interface StatsHeroProps {
  students?: number
  roadmaps?: number
  totalLessons?: number
  totalHours?: number
  extraClass?: string
}

const bars = [
  {label: 'Новые ученики', value: 15, trend: '+3%'},
  {label: 'Прошли курс', value: 15, trend: '−1%'},
  {label: 'Road-map в работе', value: 60, trend: '+8%'}
]

function Modal({isOpen, onClose}: {isOpen: boolean; onClose: () => void}) {
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
          <span className={styles.modal_title}>Подробная статистика</span>
          <button className={styles.modal_close} onClick={onClose} aria-label='Закрыть'>
            ×
          </button>
        </div>
        <StatsHeroModalContent />
      </div>
    </div>
  )
}

export function StatsHero({students = 0, roadmaps = 0, totalLessons = 0, totalHours = 0, extraClass}: StatsHeroProps) {
  const [animated, setAnimated] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const metrics = [
    {num: students, label: 'Учеников'},
    {num: roadmaps, label: 'Road-map'},
    {num: totalLessons, label: 'Уроков'},
    {num: totalHours, label: 'Часов'},
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
          more
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
