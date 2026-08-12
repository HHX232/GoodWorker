import LoginPage from '@/_pages/LoginPage/LoginPage'
import {DottedSurface} from '@/shared/ui/DottedSurface/DottedSurface'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('login') }
}

export default function page() {
  return (
    <>
      <DottedSurface />
      <LoginPage />
    </>
  )
}
