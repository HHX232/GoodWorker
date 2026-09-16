// Client-side mirror of the wire contract documented in
// `.autopilot/chat-system/interfaces.md` under "Контракт API chat/data".
// Dates travel over JSON as ISO strings (unlike the server-side
// `ConversationSummary` in `src/shared/lib/chat/access.ts`, which still holds
// `Date` objects before serialization) — this type describes what actually
// lands in the browser after `fetch(...).then(r => r.json())`.
//
// Derived from the server type via `import type` (erased at compile time —
// pulls no Prisma/auth runtime code into the client bundle) so a shape
// change on the server fails this file at compile time instead of silently
// drifting out of sync.

import type { ConversationSummary as ServerConversationSummary } from '@/shared/lib/chat/access'

export type ChatRole = 'TEACHER' | 'STUDENT'

type ServerLastMessage = NonNullable<ServerConversationSummary['lastMessage']>

export type ConversationLastMessage = Omit<ServerLastMessage, 'createdAt' | 'senderRole'> & {
  senderRole: ChatRole
  createdAt: string
}

export type ConversationSummary = Omit<ServerConversationSummary, 'createdAt' | 'lastMessageAt' | 'lastMessage'> & {
  createdAt: string
  lastMessageAt: string
  lastMessage: ConversationLastMessage | null
}
