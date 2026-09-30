import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SharedLectureLoader } from '@/widgets/Lecture/SharedLecture/SharedLectureLoader'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lecture')
  return { title: t('pageTitle'), robots: { index: false, follow: false } }
}

// A lecture's public link — no login; the token decides view or edit.
export default async function SharedLecturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SharedLectureLoader token={token} />
}
