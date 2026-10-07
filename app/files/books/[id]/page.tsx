import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { auth } from '../../../../auth'
import { BookReader } from '@/widgets/Files/BookReader/BookReader'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('files')
  return { title: t('booksReaderPageTitle') }
}

// /files/books/[id] — the book reader. Access is checked by the API (owner or a
// student with an active grant); this page only picks the role, like /files.
export default async function BookReaderRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params
  const role = session.user.role === 'STUDENT' ? 'student' : 'teacher'
  return <BookReader bookId={id} role={role} />
}
