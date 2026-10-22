import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { auth } from '../../../auth'
import { LectureWorkspaceLoader } from '@/widgets/Lecture/LectureWorkspace/LectureWorkspaceLoader'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lecture')
  return { title: t('pageTitle') }
}

export default async function LectureWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params
  return <LectureWorkspaceLoader lectureId={id} />
}
