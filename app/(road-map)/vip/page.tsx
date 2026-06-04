import {getTranslations} from 'next-intl/server'
import type {Metadata} from 'next'
import VipClientPage from './VipClientPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return {title: t('vip')}
}

export default function VipPage() {
  return <VipClientPage />
}
