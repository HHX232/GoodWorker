import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import { StudentReportPage } from '@/_pages/TeacherPages/StudentReportPage/StudentReportPage'

export default async function ReportPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user as { role: string }).role
  if (role !== 'TEACHER' && role !== 'ADMIN') redirect('/')
  return <StudentReportPage studentId={studentId} />
}
