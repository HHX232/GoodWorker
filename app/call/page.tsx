import { redirect } from 'next/navigation'
import { auth } from '../../auth'
import CallEntry from './CallEntry'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('videoCall') }
}





export default async function CallPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return <CallEntry userName={session.user.name ?? session.user.id ?? 'User'} />
}
