'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import styles from './ProfileSubNav.module.scss'

export function ProfileSubNav() {
  const t = useTranslations('LandingPage')
  const links = [
    { label: t('sub_teachers'), href: '/teachers' },
    { label: t('sub_posts'),    href: '/posts' },
    { label: t('sub_courses'),  href: '/teachers' },
    { label: t('sub_support'),  href: '/feedback' },
  ]

  return (
    <div className={styles.subnav}>
      {links.map(l => (
        <Link key={l.href + l.label} href={l.href} className={styles.subnav_link}>
          <span className={styles.subnav_dot} />
          {l.label}
        </Link>
      ))}
    </div>
  )
}
