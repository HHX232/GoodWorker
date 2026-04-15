'use client'
import {ErrorTopics} from '@/shared/ui/Stats/ErrorTopics/ErrorTopics'
import HoursChart from '@/shared/ui/Stats/HoursChart/HoursChart'
import {StatsHero} from '@/shared/ui/Stats/StatsHero/StatsHero'
import StatsHeroCard from '@/shared/ui/Stats/StatsHeroCard/StatsHeroCard'
import {SubjectsPieChart} from '@/shared/ui/Stats/SubjectsPieChart/SubjectsPieChart'
import {WeekCalendar} from '@/shared/ui/Stats/WeekCalendar/WeekCalendar'
import styles from './TutorStatsPage.module.scss'

export default function TutorStatsPage() {
  return (
    <div className={`container ${styles.dop_container}`}>
      <StatsHero students={78} roadmaps={56} totalLessons={203} />

      <div className={styles.page}>
        {' '}
        <StatsHeroCard extraClass={styles.hero_card} />
        <HoursChart extraClass={styles.hours_chart} />
        <SubjectsPieChart extraClass={styles.sub_pie} />
        <WeekCalendar extraClass={styles.week_calendar} />
        <ErrorTopics extraClass={styles.error_topics} />
      </div>
    </div>
  )
}
