import { GameSelectPage } from "@/_pages/GameSelectPage/GameSelectPage";

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('games') }
}


export default function Page() {
  return <GameSelectPage />;
}
