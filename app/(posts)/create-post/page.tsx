import CreatePostPage from '@/_pages/CreatePostPage/CreatePostPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('createPost') }
}


export default function CreatePostServerPage() {
  return <CreatePostPage />
}
