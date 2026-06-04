import EditPostPage from '@/_pages/EditPostPage/EditPostPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('editPost') }
}


interface Props {
  params: Promise<{id: string}>
}

export default async function EditPostServerPage({params}: Props) {
  const {id} = await params
  return <EditPostPage id={id} />
}
