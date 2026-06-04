import {getTranslations} from 'next-intl/server'
import type {Metadata} from 'next'
import {CreateRoadMapWrapper} from './CreateRoadMapWrapper'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return {title: t('createCourse')}
}

export default function CreateRoadMapPage() {
  return <CreateRoadMapWrapper />
}
