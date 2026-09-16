'use client'

import { ChatShell } from '@/widgets/Chat/ChatShell/ChatShell'
import { ConversationView } from '@/widgets/Chat/ConversationView/ConversationView'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

/**
 * Reads `?conversationId=<id>` (set by `ChatEntryPoints`, e.g.
 * `StudentDetailModal`'s "Перейти в чат" button, after its own
 * get-or-create) and hands it to `ChatShell` as `initialConversationId` so
 * the deep link opens straight into that dialog instead of the bare list.
 * Split out from `ChatPage` because `useSearchParams()` requires a
 * `<Suspense>` boundary above it.
 */
function ChatPageInner() {
  const searchParams = useSearchParams()
  const conversationId = searchParams.get('conversationId') ?? undefined

  return (
    <ChatShell
      initialConversationId={conversationId}
      renderConversation={({ conversation, onBack }) => (
        <ConversationView conversation={conversation} onBack={onBack} />
      )}
    />
  )
}

/**
 * Thin client-side composition root for the `/chats` page. Exists only
 * because `app/chats/page.tsx` is a Server Component and can't pass a
 * closure (`renderConversation`) directly to the client `ChatShell` — React
 * rejects functions crossing the server/client boundary as props. Wiring
 * `ChatShell` to `ConversationView` here keeps both function and usage on
 * the client side of that boundary.
 */
export function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  )
}
