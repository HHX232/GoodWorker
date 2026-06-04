import { NotificationsPage } from '@/_pages/NotificationsPage/NotificationsPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('notifications') }
}


export default function Page() {
  return <NotificationsPage />
}
