import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ChessPlayPage, type StartRequest } from '@/_pages/Chess/Play/ChessPlayPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.play')
  return { title: t('play_title') }
}

// ?fen=<FEN>[&color=w|b] starts from that position (task 05: "play on from here"); bad FEN → normal start + toast.
// ?new=bot&bot=<BOTS id>&color=w|b&coach=0|1 | ?new=duo — a fresh game from the hub's New game modal.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { fen, color, new: fresh, bot, coach } = await searchParams
  const startNew: StartRequest | undefined =
    fresh === 'duo'
      ? { mode: 'duo' }
      : fresh === 'bot'
      ? { mode: 'ai', botId: typeof bot === 'string' ? bot : undefined, color: color === 'b' ? 'b' : 'w', coach: coach !== '0' }
      : undefined
  return (
    <ChessPlayPage
      initialFen={typeof fen === 'string' ? fen : undefined}
      initialColor={typeof color === 'string' ? color : undefined}
      startNew={startNew}
    />
  )
}
