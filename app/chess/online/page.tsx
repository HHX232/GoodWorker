import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { OnlineLobbyPage } from '@/_pages/Chess/Online/OnlineLobbyPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.online')
  return { title: t('title') }
}

// ?tc=1+0|3+2|10+0 preselects the time control (the New game modal's online tab links here)
export default async function Page({ searchParams }: { searchParams: Promise<{ tc?: string | string[] }> }) {
  const { tc } = await searchParams
  return <OnlineLobbyPage tc={typeof tc === 'string' ? tc : undefined} />
}
