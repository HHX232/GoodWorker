import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import TutorStatsPage from '@/_pages/TeacherPages/TutorStatsPage/TutorStatsPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('statistics') }
}


export default async function StatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const { role, id: userId } = session.user as { role: string; id: string }

  if (role !== 'ADMIN' && !(role === 'TEACHER' && userId === id)) {
    redirect('/profile')
  }

  return <TutorStatsPage teacherId={id} />
}
