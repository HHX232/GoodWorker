import { PacmanGamePage } from "@/_pages/PacmanGamePage/PacmanGamePage";

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('pacman') }
}


export default function Page() {
  return <PacmanGamePage />;
}
