import { redirect } from 'next/navigation'
import { auth } from '../../auth'
import CallEntry from './CallEntry'

export const metadata = { title: 'Видео-звонок' }

export default async function CallPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return <CallEntry userName={session.user.name ?? session.user.id ?? 'User'} />
}
