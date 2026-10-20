import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { OnlineGamePage } from '@/_pages/Chess/Game/OnlineGamePage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.online')
  return { title: t('title') }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OnlineGamePage id={id} />
}
