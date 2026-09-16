'use client'

import { ChatShell } from '@/widgets/Chat/ChatShell/ChatShell'
import { ConversationView } from '@/widgets/Chat/ConversationView/ConversationView'

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
    <ChatShell
      renderConversation={({ conversation, onBack }) => (
        <ConversationView conversation={conversation} onBack={onBack} />
      )}
    />
  )
}
