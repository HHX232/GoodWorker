import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { LectureLanding } from '@/_pages/PublickPages/LectureLanding/LectureLanding'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lectureLanding')
  return { title: t('metaTitle'), description: t('metaDescription') }
}

// Public landing for /lecture (the hero variant comes from ?hero= — hence the Suspense for useSearchParams).
export default function LectureInfoPage() {
  return (
    <Suspense>
      <LectureLanding />
    </Suspense>
  )
}
