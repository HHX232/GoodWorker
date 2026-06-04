import { AdminPage } from '@/_pages/AdminPage/AdminPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('admin') }
}


export default function Page() {
  return <AdminPage />
}
