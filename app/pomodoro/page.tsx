import { PomodoroPage } from "@/_pages/PomodoroPage/PomodoroPage";

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('pomodoro') }
}


export default function Page() {
  return <PomodoroPage />;
}
