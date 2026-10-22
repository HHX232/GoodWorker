import { redirect } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { auth } from '../../../auth'
import { hasStorageAccess } from '@/shared/lib/tutorFiles/access'
import { BooksPage } from '@/widgets/Files/BooksPage/BooksPage'

// Same mono face as /files — book titles are set in it.
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500'], variable: '--files-mono', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('files')
  return { title: t('booksPageTitle') }
}

// /files/books — "All books" (design A). Same auth shape as /files; ADMIN is the seed tutor account → teacher view.
// Access to the books themselves is checked by the API (owner or a student with an active grant).
export default async function BooksRoute() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role === 'STUDENT' ? 'student' : 'teacher'
  // Same gate as FilesShell's canManage: an active-VIP (or admin) tutor may upload/share/delete.
  const canManage = role === 'teacher' && (await hasStorageAccess(session.user.id))
  return <BooksPage role={role} canManage={canManage} fontClassName={mono.variable} />
}
