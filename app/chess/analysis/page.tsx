import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ChessAnalysisPage } from '@/_pages/Chess/Analysis/ChessAnalysisPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.analysis')
  return { title: t('title') }
}

// ?game=<id> — an online game (GET /api/chess/games/[id]); otherwise sessionStorage['gw-chess-analysis'] or a pasted PGN.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { game } = await searchParams
  return <ChessAnalysisPage gameId={typeof game === 'string' && game ? game : undefined} />
}
