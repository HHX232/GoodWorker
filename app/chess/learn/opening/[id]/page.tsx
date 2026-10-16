import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getOpening } from '@/shared/lib/chess/data'
import { OpeningPage } from '@/_pages/Chess/Learn/OpeningPage'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const opening = getOpening((await params).id)
  const t = await getTranslations('chess.learn')
  return { title: opening ? t(opening.nameKey) : t('ln_title') }
}

export default async function Page({ params }: Props) {
  const opening = getOpening((await params).id)
  if (!opening) notFound()
  return <OpeningPage opening={opening} />
}
