import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { StormPage } from '@/_pages/Chess/Storm/StormPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.storm')
  return { title: t('title') }
}

// ?mode=3|5 starts that run right away (the shell's "Puzzles and storm" modal)
export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const { mode } = await searchParams
  return <StormPage start={mode === '3' ? 3 : mode === '5' ? 5 : undefined} />
}
