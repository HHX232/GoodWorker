import {getTranslations} from 'next-intl/server'
import type {Metadata} from 'next'
import {CreateTestDndWrapper} from './CreateTestDndWrapper'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return {title: t('createTest')}
}

export default function CreateTestServerPage() {
  return <CreateTestDndWrapper />
}
