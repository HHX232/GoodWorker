'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ErrorTopics, TopicSubject } from '@/shared/ui/Stats/ErrorTopics/ErrorTopics'
import HoursChart from '@/shared/ui/Stats/HoursChart/HoursChart'
import { StatsHero } from '@/shared/ui/Stats/StatsHero/StatsHero'
import StatsHeroCard from '@/shared/ui/Stats/StatsHeroCard/StatsHeroCard'
import { SubjectsPieChart } from '@/shared/ui/Stats/SubjectsPieChart/SubjectsPieChart'
import { WeekCalendar, CalendarLesson } from '@/shared/ui/Stats/WeekCalendar/WeekCalendar'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import styles from './TutorStatsPage.module.scss'

interface SubjectItem {
  name: string
  hours: number
  count: number
  color: string
}

interface RecentCall {
  id: string
  name: string
  topic: string | null
  createdAt: string
  endedAt: string
  durationHours: number
  participantCount: number
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
  recentCalls: RecentCall[]
  calendarLessons: CalendarLesson[]
  calendarEvents: CalendarEvent[]
  heroStats: HeroStats
}

function calendarEventToLesson(e: CalendarEvent): CalendarLesson {
  const [sh, sm] = e.startTime.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  const duration = Math.max(1, eh * 60 + em - (sh * 60 + sm))
  return {
    id: `evt-${e.id}`,
    studentName: e.studentName ?? e.title,
    subject: e.subject ?? 'Событие',
    time: e.startTime,
    duration,
    date: `${e.date}T${e.startTime}:00`,
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function SubjectCallsModal({
  subject,
  calls,
  onClose,
}: {
  subject: TopicSubject
  calls: RecentCall[]
  onClose: () => void
}) {
  const t = useTranslations('statsPage.subjectModal')
  const tHours = useTranslations('statsPage.hoursChart')
  const filtered = calls.filter((c) => (c.topic?.trim() || 'Без темы') === subject.name)

  return (
    <ModalWindowDefault
      isOpen
      onClose={onClose}
      additionalTitle={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: subject.color, display: 'inline-block' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{subject.name}</span>
        </div>
      }
    >
      <div style={{ padding: '4px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('lessons')}</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>{subject.count}</p>
          </div>
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('hours')}</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>{subject.hours}</p>
          </div>
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('avg')}</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
              {subject.count > 0 ? (subject.hours / subject.count).toFixed(1) : 0} {tHours('hoursUnit')}
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: '#bbb', textAlign: 'center', fontSize: 13, padding: '20px 0' }}>{t('noLessons')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {filtered.map((call) => (
              <div
                key={call.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#f8f8f8',
                  borderRadius: 12,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{formatDate(call.createdAt)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                    {formatTime(call.createdAt)} · {call.participantCount} {t('participants')}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{call.durationHours} {tHours('hoursUnit')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalWindowDefault>
  )
}

export default function TutorStatsPage({ teacherId }: { teacherId: string }) {
  const t = useTranslations('statsPage')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<TopicSubject | null>(null)

  useEffect(() => {
    fetch(`/api/statistics/${teacherId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(() => setError(t('loading')))
      .finally(() => setLoading(false))
  }, [teacherId, t])

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
    <>
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
              ...data.calendarEvents.map(calendarEventToLesson),
            ]}
          />
          <ErrorTopics
            extraClass={styles.error_topics}
            subjects={data.subjectData}
            onSubjectClick={(s) => setSelectedSubject(s)}
          />
        </div>
      </div>

      {selectedSubject && (
        <SubjectCallsModal
          subject={selectedSubject}
          calls={data.recentCalls}
          onClose={() => setSelectedSubject(null)}
        />
      )}
    </>
  )
}
