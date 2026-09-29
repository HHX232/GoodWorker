import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { auth } from '../../auth'
import { LectureHome } from '@/widgets/Lecture/LectureHome/LectureHome'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lecture')
  return { title: t('pageTitle') }
}

// /lecture — live lecture notes (VIP student / VIP tutor / admin). The VIP
// gate itself is in the API; the page shows the upsell when it answers 403.
export default async function LecturePage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <LectureHome />
}
