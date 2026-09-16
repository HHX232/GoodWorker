// Client-side mirror of the wire contract documented in
// `.autopilot/chat-system/interfaces.md` under "Контракт API chat/data".
// Dates travel over JSON as ISO strings (unlike the server-side
// `ConversationSummary` in `src/shared/lib/chat/access.ts`, which still holds
// `Date` objects before serialization) — this type describes what actually
// lands in the browser after `fetch(...).then(r => r.json())`.

export type ChatRole = 'TEACHER' | 'STUDENT'

export interface ConversationLastMessage {
  text: string | null
  attachmentType: string | null
  eventType: string | null
  senderRole: ChatRole
  createdAt: string
}

export interface ConversationSummary {
  id: string
  otherId: string
  otherName: string
  otherAvatarUrl: string | null
  createdAt: string
  lastMessageAt: string
  lastMessage: ConversationLastMessage | null
  unreadCount: number
}
