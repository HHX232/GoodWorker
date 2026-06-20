import RegisterPage from '@/_pages/RegisterPage/RegisterPage'
import StarBackground from '@/shared/ui/backgrounds/StarBackground/StarBackground'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('register') }
}


export default function page() {
  return (
    <>
      {' '}
      <StarBackground />
      <RegisterPage />
    </>
  )
}
