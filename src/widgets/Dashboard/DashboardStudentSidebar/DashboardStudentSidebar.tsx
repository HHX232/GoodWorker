'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import styles from './DashboardStudentSidebar.module.scss'

interface Student {
  id: string
  name: string
  initials: string
  subject: string
  avatarColor: string
  avatarTextColor: string
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime: string
  studentName?: string
}

interface Props {
  teacherId: string
}

const STATUS_COLORS = ['#22C55E', '#F0B429', '#EF4444', '#534AB7', '#22C55E']

function getStatus(student: Student, idx: number) {
  return STATUS_COLORS[idx % STATUS_COLORS.length]
}

function getProgress(student: Student): number {
  let h = 0
  for (let i = 0; i < student.id.length; i++) h = (h * 31 + student.id.charCodeAt(i)) >>> 0
  return 20 + (h % 70)
}

function getNextLessonRaw(studentName: string, events: CalendarEvent[]): { time: string; diff: number; date: string } | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = events
    .filter(e => e.studentName && e.studentName === studentName)
    .filter(e => {
      const d = new Date(e.date)
      d.setHours(0, 0, 0, 0)
      return d >= today
    })
    .sort((a, b) => {
      const da = new Date(`${a.date}T${a.startTime}`)
      const db = new Date(`${b.date}T${b.startTime}`)
      return da.getTime() - db.getTime()
    })
  if (!upcoming[0]) return null
  const ev = upcoming[0]
  const evDate = new Date(ev.date)
  evDate.setHours(0, 0, 0, 0)
  const todayLabel = new Date(); todayLabel.setHours(0, 0, 0, 0)
  const diff = Math.round((evDate.getTime() - todayLabel.getTime()) / 86400000)
  return { time: ev.startTime, diff, date: ev.date }
}

export function DashboardStudentSidebar({ teacherId }: Props) {
  const t = useTranslations('dashboard')
  const [students, setStudents] = useState<Student[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeSubject, setActiveSubject] = useState('All')

  useEffect(() => {
    Promise.all([
      fetch(`/api/teacher/students?teacherId=${teacherId}`).then(r => r.json()),
      fetch(`/api/teacher/calendar?teacherId=${teacherId}`).then(r => r.json()),
    ]).then(([studentsData, calData]) => {
      if (Array.isArray(studentsData.students)) setStudents(studentsData.students)
      if (Array.isArray(calData.events)) setEvents(calData.events)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [teacherId])

  const subjects = useMemo(() => {
    const set = new Set(students.map(s => s.subject).filter(Boolean))
    return ['All', ...Array.from(set)]
  }, [students])

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
      const matchSubject = activeSubject === 'All' || s.subject === activeSubject
      return matchSearch && matchSubject
    })
  }, [students, search, activeSubject])

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{t('students')}</span>
          <span className={styles.badge}>{students.length}</span>
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className={styles.search}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          {subjects.map(s => (
            <button
              key={s}
              className={`${styles.filterBtn} ${activeSubject === s ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveSubject(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {loading && <div className={styles.loading}>{t('loading')}</div>}

        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            {search ? t('noResults') : t('noStudents')}
          </div>
        )}

        {!loading && filtered.map((student, idx) => {
          const nextLesson = getNextLessonRaw(student.name, events)
          const progress = getProgress(student)
          const statusColor = getStatus(student, idx)
          const nextLabel = nextLesson
            ? `${nextLesson.time} · ${nextLesson.diff === 0 ? t('today') : nextLesson.diff === 1 ? t('tomorrow') : nextLesson.date}`
            : null

          return (
            <div key={student.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div
                  className={styles.avatar}
                  style={{ background: student.avatarColor, color: student.avatarTextColor }}
                >
                  {student.initials}
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>{student.name}</div>
                  {student.subject && (
                    <div className={styles.cardSubject}>{student.subject}</div>
                  )}
                </div>
                <div className={styles.statusDot} style={{ background: statusColor }} />
              </div>

              <div className={styles.nextRow}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span className={styles.nextTime}>
                  {nextLabel ?? <span style={{ color: '#ABABAB', fontWeight: 400 }}>{t('noLessonsScheduled')}</span>}
                </span>
              </div>

              <div className={styles.progressWrap}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
