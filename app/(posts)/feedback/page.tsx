import { FeedbackPage } from '@/_pages/FeedbackPage/FeedbackPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('feedback') }
}


export default function Page() {
  return <FeedbackPage />
}
