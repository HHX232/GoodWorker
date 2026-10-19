import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ChessProfilePage } from '@/_pages/Chess/Profile/ChessProfilePage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.progress')
  return { title: t('profile_me') }
}

export default function Page() {
  return <ChessProfilePage />
}
