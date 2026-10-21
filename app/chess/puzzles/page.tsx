import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PuzzlesPage, type PuzzleMode } from '@/_pages/Chess/Puzzles/PuzzlesPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.learn')
  return { title: t('pz_title') }
}

const MODES: PuzzleMode[] = ['rated', 'theme', 'series', 'opening']
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

// /chess/puzzles?mode=rated|theme|series|opening&theme=<lichess theme>&opening=<lichess opening tag>
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams
  const mode = one(q.mode)
  // keyed: picking a mode in the shell's modal while already here starts that mode afresh
  return <PuzzlesPage key={`${mode}|${one(q.theme)}|${one(q.opening)}`} mode={MODES.includes(mode as PuzzleMode) ? (mode as PuzzleMode) : undefined} theme={one(q.theme)} opening={one(q.opening)} />
}
