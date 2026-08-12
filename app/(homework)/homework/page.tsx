import { auth } from '../../../auth'
import { redirect } from 'next/navigation'
import HomeworkListPage from '@/_pages/HomeworkPages/HomeworkListPage/HomeworkListPage'

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDENT') redirect('/')
  return <HomeworkListPage />
}
