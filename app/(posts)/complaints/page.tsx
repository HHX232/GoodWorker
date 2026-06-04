import { ComplaintsPage } from '@/_pages/ComplaintsPage/ComplaintsPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('complaints') }
}


export default function Page() {
  return <ComplaintsPage />
}
