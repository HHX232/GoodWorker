'use client'

import { DashboardCenter } from '@/widgets/Dashboard/DashboardCenter/DashboardCenter'
import { PublicReviewsSidebar } from '@/widgets/Dashboard/PublicReviewsSidebar/PublicReviewsSidebar'
import { PublicTeacherPanel } from '@/widgets/Dashboard/PublicTeacherPanel/PublicTeacherPanel'
import { useEffect } from 'react'
import styles from './TeacherPublicProfile.module.scss'

interface CategoryTranslation {
  langCode: string
  name: string
}

interface Category {
  id: string
  slug: string
  translations: CategoryTranslation[]
}

interface Props {
  teacherId: string
  name: string
  avatarUrl: string | null
  isVip: boolean
  createdAt: string
  studentCount: number
  postCount: number
  callCount: number
  categories: Category[]
  locale?: string
  bio?: string | null
  coverPhotoUrl?: string | null
  socialLinks?: Record<string, string> | null
  experiences?: { id: string; title: string; organization: string | null; yearFrom: number; yearTo: number | null; description: string | null; verifiedAt: string | null }[]
}

export function TeacherPublicProfile({
  teacherId, name, avatarUrl, isVip, createdAt,
  studentCount, postCount, callCount, categories, locale,
  bio, coverPhotoUrl, socialLinks, experiences,
}: Props) {
  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement | null
    if (!header) return
    header.style.marginBottom = '0'
    return () => { header.style.marginBottom = '' }
  }, [])

  return (
    <div className={styles.dashboard}>
      <PublicReviewsSidebar teacherId={teacherId} />
      <DashboardCenter statsId={teacherId} studentCount={studentCount} callCount={callCount} />
      <PublicTeacherPanel
        name={name}
        avatarUrl={avatarUrl}
        isVip={isVip}
        createdAt={createdAt}
        studentCount={studentCount}
        postCount={postCount}
        callCount={callCount}
        categories={categories}
        locale={locale}
        bio={bio}
        coverPhotoUrl={coverPhotoUrl}
        socialLinks={socialLinks}
        experiences={experiences}
      />
    </div>
  )
}
