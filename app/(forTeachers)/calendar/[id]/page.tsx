import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import { CalendarPage } from '@/_pages/CalendarPage/CalendarPage'

export default async function CalendarPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const { role, id: userId } = session.user as { role: string; id: string }

  if (role !== 'ADMIN' && !(role === 'TEACHER' && userId === id)) {
    redirect('/profile')
  }

  return <CalendarPage teacherId={id} />
}
