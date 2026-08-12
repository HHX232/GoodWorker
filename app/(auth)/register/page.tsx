import RegisterPage from '@/_pages/RegisterPage/RegisterPage'
import {DottedSurface} from '@/shared/ui/DottedSurface/DottedSurface'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('register') }
}

export default function page() {
  return (
    <>
      <DottedSurface />
      <RegisterPage />
    </>
  )
}
