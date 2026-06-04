import LoginPage from '@/_pages/LoginPage/LoginPage';
import ShaderBackground from '@/shared/ui/backgrounds/Shaderbackground/Shaderbackground';

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('login') }
}


export default function page() {
  return <>
  <ShaderBackground />
  
    <LoginPage />
  </>
}
