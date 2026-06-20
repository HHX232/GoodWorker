import { auth } from '../../../auth'
import { redirect } from 'next/navigation'
import { StudentCalendarPage } from '@/_pages/StudentCalendarPage/StudentCalendarPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('calendar') }
}

export default async function StudentCalendarRoute() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role } = session.user as { role: string }
  if (role !== 'STUDENT') redirect('/profile')

  return <StudentCalendarPage />
}
