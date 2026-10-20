import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { OnlineLobbyPage } from '@/_pages/Chess/Online/OnlineLobbyPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.online')
  return { title: t('title') }
}

export default function Page() {
  return <OnlineLobbyPage />
}
