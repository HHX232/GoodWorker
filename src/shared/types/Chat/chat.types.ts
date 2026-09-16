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
import type { ChatMessage as PrismaChatMessage } from '@prisma/client'

export type ChatRole = 'TEACHER' | 'STUDENT'

/**
 * Client-side mirror of the `ChatMessage` Prisma model, exactly as it comes
 * back from `GET/POST /api/chat/conversations/[id]/messages` (see
 * "Контракт API chat/data" in interfaces.md) — `createdAt` travels as an ISO
 * string over JSON instead of the `Date` object Prisma holds server-side,
 * and `senderRole` narrows from the wider Prisma `Role` enum to the two
 * roles that actually send chat messages.
 */
export type ChatMessage = Omit<PrismaChatMessage, 'createdAt' | 'senderRole'> & {
  senderRole: ChatRole
  createdAt: string
}

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
