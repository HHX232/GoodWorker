import { ChessGamePage } from "@/_pages/ChessGamePage/ChessGamePage";

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('chess') }
}


export default function Page() {
  return <ChessGamePage />;
}
