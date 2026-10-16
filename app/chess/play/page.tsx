import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ChessPlayPage } from '@/_pages/Chess/Play/ChessPlayPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.play')
  return { title: t('play_title') }
}

// ?fen=<FEN>[&color=w|b] starts from that position (task 05: "play on from here"); bad FEN → normal start + toast.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { fen, color } = await searchParams
  return <ChessPlayPage initialFen={typeof fen === 'string' ? fen : undefined} initialColor={typeof color === 'string' ? color : undefined} />
}
