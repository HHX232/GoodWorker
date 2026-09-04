'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import styles from './ProfileSubNav.module.scss'

interface ProfileSubNavProps {
  calendarHref?: string
  statisticsHref?: string
}

export function ProfileSubNav({ calendarHref, statisticsHref }: ProfileSubNavProps = {}) {
  const t = useTranslations('LandingPage')
  const links = [
    { label: t('sub_teachers'), href: '/teachers' },
    { label: t('sub_posts'),    href: '/posts' },
    { label: t('sub_courses'),  href: '/workflows-list' },
    { label: t('sub_support'),  href: '/feedback' },
  ]
  const ownLinks = [
    calendarHref ? { label: t('sub_calendar'), href: calendarHref } : null,
    statisticsHref ? { label: t('sub_stats'), href: statisticsHref } : null,
  ].filter((l): l is { label: string; href: string } => l !== null)

  return (
    <div className={styles.subnav}>
      {ownLinks.map(l => (
        <Link key={l.href + l.label} href={l.href} className={styles.subnav_link}>
          <span className={styles.subnav_dot} />
          {l.label}
        </Link>
      ))}
      {ownLinks.length > 0 && <span className={styles.subnav_sep} aria-hidden='true' />}
      {links.map(l => (
        <Link key={l.href + l.label} href={l.href} className={styles.subnav_link}>
          <span className={styles.subnav_dot} />
          {l.label}
        </Link>
      ))}
    </div>
  )
}
