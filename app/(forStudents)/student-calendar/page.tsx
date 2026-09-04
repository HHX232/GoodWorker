import { auth } from '../../../auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/shared/prisma/prisma'
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

  const { role, id } = session.user as { role: string; id: string }
  if (role !== 'STUDENT') redirect('/profile')

  const student = await prisma.student.findUnique({
    where: { id },
    select: { isVip: true, vipExpiresAt: true },
  }).catch(() => null)

  const isVip =
    student?.isVip === true && (student.vipExpiresAt === null || student.vipExpiresAt > new Date())

  return <StudentCalendarPage isVip={isVip} studentId={id} />
}
