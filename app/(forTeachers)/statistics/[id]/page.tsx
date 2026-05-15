import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import TutorStatsPage from '@/_pages/TeacherPages/TutorStatsPage/TutorStatsPage'

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
