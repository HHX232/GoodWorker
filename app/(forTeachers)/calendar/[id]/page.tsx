import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import { CalendarPage } from '@/_pages/CalendarPage/CalendarPage'
import { prisma } from '@/shared/prisma/prisma'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('calendar') }
}

export default async function CalendarPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const { role, id: userId } = session.user as { role: string; id: string }

  if (role !== 'ADMIN' && !(role === 'TEACHER' && userId === id)) {
    redirect('/profile')
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { isVip: true },
  }).catch(() => null)

  return <CalendarPage teacherId={id} isVip={teacher?.isVip ?? false} />
}
