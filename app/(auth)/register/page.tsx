import RegisterPage from '@/_pages/RegisterPage/RegisterPage'
import ShaderBackground from '@/shared/ui/backgrounds/Shaderbackground/Shaderbackground'

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
      <ShaderBackground />
      <RegisterPage />
    </>
  )
}
