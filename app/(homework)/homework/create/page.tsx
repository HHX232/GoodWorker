import CreateHomeworkPage from '@/_pages/HomeworkPages/CreateHomeworkPage/CreateHomeworkPage'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('homework')
  return { title: t('createTitle') }
}

export default function CreateHomeworkServerPage() {
  return <CreateHomeworkPage />
}
