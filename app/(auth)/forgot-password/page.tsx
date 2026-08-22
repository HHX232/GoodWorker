import ForgotPasswordPage from '@/_pages/ForgotPasswordPage/ForgotPasswordPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('forgotPassword') }
}

export default function page() {
  return <ForgotPasswordPage />
}
