import { redirect } from 'next/navigation'
import { auth } from '../../auth'
import { ChatPage } from '@/widgets/Chat/ChatPage/ChatPage'

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
  // `ChatPage` (client component) wires the real dialog (ticket 03) into
  // ChatShell's `renderConversation` slot — a Server Component can't pass a
  // closure prop directly to a Client Component, so that composition has
  // to live on the client side of the boundary.
  return <ChatPage />
}
