import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LearnPage } from '@/_pages/Chess/Learn/LearnPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.learn')
  return { title: t('ln_title') }
}

// /chess/learn?tab=tactics|openings
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams
  return <LearnPage tab={tab === 'openings' ? 'openings' : 'tactics'} />
}
