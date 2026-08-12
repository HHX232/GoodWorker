import { redirect } from 'next/navigation'
import { auth } from '../../../../../auth'
import { HomeworkResultsPage } from '@/_pages/HomeworkPages/HomeworkResultsPage/HomeworkResultsPage'

export default async function HomeworkResultsServerPage({
  params,
}: {
  params: Promise<{ hwId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER') redirect('/profile')

  const { hwId } = await params
  return <HomeworkResultsPage hwId={hwId} />
}
