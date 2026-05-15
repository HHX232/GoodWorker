import { auth } from '../../../auth'
import { redirect } from 'next/navigation'

export default async function CalendarRootPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { id, role } = session.user as { id: string; role: string }
  if (role !== 'TEACHER' && role !== 'ADMIN') redirect('/profile')

  redirect(`/calendar/${id}`)
}
