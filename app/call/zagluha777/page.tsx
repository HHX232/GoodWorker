import { auth } from '../../../auth'
import { redirect } from 'next/navigation'
import StubRoom from './StubRoom'

export const metadata = { title: 'GoodWorker — Видеокомната (стаб)' }

export default async function ZagluhaPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userName = session.user.name ?? session.user.id ?? 'Пользователь'

  return <StubRoom userName={userName} />
}
