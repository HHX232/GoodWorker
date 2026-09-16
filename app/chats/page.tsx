import { redirect } from 'next/navigation'
import { auth } from '../../auth'
import { ChatShell } from '@/widgets/Chat/ChatShell/ChatShell'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('chats') }
}

export default async function ChatsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Both TEACHER/ADMIN and STUDENT sessions land here — the list itself is
  // scoped server-side by `GET /api/chat/conversations` (role decides
  // teacherId vs studentId), ChatShell doesn't need the role at all.
  return <ChatShell />
}
