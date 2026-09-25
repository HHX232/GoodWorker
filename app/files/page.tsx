import { redirect } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { auth } from '../../auth'
import { FilesPage } from '@/widgets/Files/FilesPage/FilesPage'

// Floe's card titles are set in a mono face; JetBrains Mono carries Cyrillic.
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500'], variable: '--files-mono', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('files')
  return { title: t('pageTitle') }
}

// /files — the tutor file library (VIP) and, for students, what tutors shared.
// Same auth shape as /chats; ADMIN is the seed tutor account → teacher view.
export default async function FilesRoute() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role === 'STUDENT' ? 'student' : 'teacher'
  return <FilesPage role={role} fontClassName={mono.variable} />
}
