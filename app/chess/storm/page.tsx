import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { StormPage } from '@/_pages/Chess/Storm/StormPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.storm')
  return { title: t('title') }
}

export default function Page() {
  return <StormPage />
}
