'use client'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { StudentErrorsWidget, ErrorStat } from '@/shared/ui/Stats/StudentErrorsWidget/StudentErrorsWidget'
import HoursChart from '@/shared/ui/Stats/HoursChart/HoursChart'
import { StatsHero } from '@/shared/ui/Stats/StatsHero/StatsHero'
import StatsHeroCard from '@/shared/ui/Stats/StatsHeroCard/StatsHeroCard'
import { SubjectsPieChart } from '@/shared/ui/Stats/SubjectsPieChart/SubjectsPieChart'
import { WeekCalendar, CalendarLesson } from '@/shared/ui/Stats/WeekCalendar/WeekCalendar'
import styles from './TutorStatsPage.module.scss'

interface SubjectItem {
  name: string
  hours: number
  count: number
  color: string
}

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  date: string
  studentName?: string
  subject?: string
}

interface HeroStats {
  newStudentsThisMonth: number
  newStudentsPrevMonth: number
  completedStudentsCount: number
  activeProgressCount: number
  totalStudents: number
  totalProgress: number
}

interface StatsData {
  teacher: { id: string; name: string; avatarUrl: string | null }
  totalCalls: number
  totalHours: number
  studentCount: number
  roadmapCount: number
  monthsData: Record<string, { day: string; hours: number }[]>
  subjectData: SubjectItem[]
  calendarLessons: CalendarLesson[]
  calendarEvents: CalendarEvent[]
  heroStats: HeroStats
  errorStats: ErrorStat[]
  correctionStats?: ErrorStat[]
}

function calendarEventToLesson(e: CalendarEvent, eventSubject: string): CalendarLesson {
  const [sh, sm] = e.startTime.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  const duration = Math.max(1, eh * 60 + em - (sh * 60 + sm))
  return {
    id: `evt-${e.id}`,
    studentName: e.studentName ?? e.title,
    subject: e.subject ?? eventSubject,
    time: e.startTime,
    duration,
    date: `${e.date}T${e.startTime}:00`,
  }
}

export default function TutorStatsPage({ teacherId }: { teacherId: string }) {
  const t = useTranslations('statsPage')
  const locale = useLocale()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/statistics/${teacherId}`)
      .then((r) => r.json())
      .then(async (d) => {
        if (d.error) { setError(d.error); return }

        // Translate subject names lazily if not Russian
        if (locale !== 'ru' && d.subjectData?.length) {
          try {
            const topics = d.subjectData.map((s: SubjectItem) => s.name)
            const res = await fetch('/api/translate-topics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ topics, langCode: locale }),
            })
            if (res.ok) {
              const { translations } = await res.json()
              d.subjectData = d.subjectData.map((s: SubjectItem, i: number) => ({
                ...s, name: translations[i] ?? s.name,
              }))
            }
          } catch {}
        }

        setData(d)
      })
      .catch(() => setError(t('loading')))
      .finally(() => setLoading(false))
  }, [teacherId, t, locale])

  if (loading) {
    return (
      <div className={`container ${styles.dop_container}`}>
        <div className={styles.loading}>{t('loading')}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`container ${styles.dop_container}`}>
        <div className={styles.error}>{error ?? t('noData')}</div>
      </div>
    )
  }

  return (
    <div className={`container ${styles.dop_container}`}>
      <StatsHero
        students={data.studentCount}
        roadmaps={data.roadmapCount}
        totalLessons={data.totalCalls}
        totalHours={data.totalHours}
        heroStats={data.heroStats}
      />

      <div className={styles.page}>
        <StatsHeroCard extraClass={styles.hero_card} teacher={data.teacher} />
        <HoursChart extraClass={styles.hours_chart} monthsData={data.monthsData} />
        <SubjectsPieChart extraClass={styles.sub_pie} data={data.subjectData} />
        <WeekCalendar
          extraClass={styles.week_calendar}
          lessons={[
            ...data.calendarLessons,
            ...data.calendarEvents.map((e) => calendarEventToLesson(e, t('eventSubject'))),
          ]}
        />
        <StudentErrorsWidget
          extraClass={styles.error_topics}
          data={data.errorStats}
        />
        {data.correctionStats && data.correctionStats.length > 0 && (
          <StudentErrorsWidget
            extraClass={styles.error_topics_subjects}
            data={data.correctionStats}
            title={t('correctionStats')}
          />
        )}
      </div>
    </div>
  )
}
