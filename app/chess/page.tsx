import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ChessHubPage } from '@/_pages/Chess/Hub/ChessHubPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.play')
  return { title: t('hub_title') }
}

export default function Page() {
  return <ChessHubPage />
}
