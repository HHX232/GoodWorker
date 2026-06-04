import { redirect } from 'next/navigation'
import { auth } from '../../../../auth'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('editTest') }
}

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  redirect(`/create-test?id=${id}`)
}
