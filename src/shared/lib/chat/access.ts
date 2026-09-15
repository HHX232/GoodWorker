import { prisma } from '@/shared/prisma/prisma'
import type { Conversation, Role } from '@prisma/client'
import { auth } from '../../../../auth'

/** 10 MB — server-side mirror of the client attachment cap (R16). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export type ChatRole = 'TEACHER' | 'STUDENT'

export interface ChatSessionUser {
  id: string
  role: ChatRole
}

/**
 * Resolves the current session to a chat participant. Chat only exists
 * between a teacher and a student. A session with role ADMIN maps to TEACHER
 * using the same `id` — their `Teacher` row is the same entity, ADMIN is
 * just a site-wide privilege layered on top (same convention already used
 * by the calendar/payment-reminder routes: `role === 'TEACHER' || role === 'ADMIN'`).
 * No session at all returns null.
 */
export async function getChatSessionUser(): Promise<ChatSessionUser | null> {
  const session = await auth()
  const role = session?.user?.role
  if (!session?.user?.id) return null
  if (role === 'TEACHER' || role === 'ADMIN') return { id: session.user.id, role: 'TEACHER' }
  if (role === 'STUDENT') return { id: session.user.id, role: 'STUDENT' }
  return null
}

export function otherRole(role: ChatRole): ChatRole {
  return role === 'TEACHER' ? 'STUDENT' : 'TEACHER'
}

export async function hasTeacherStudentLink(teacherId: string, studentId: string): Promise<boolean> {
  const link = await prisma.teacherStudent.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
  })
  return !!link
}

/**
 * Loads a conversation and verifies the current user is one of its two
 * sides. Returns `null` if the conversation does not exist at all (→ 404),
 * and `'forbidden'` if it exists but belongs to someone else (→ 403) — the
 * seam every message/read route needs before touching a conversation.
 */
export async function getOwnedConversation(
  conversationId: string,
  user: ChatSessionUser
): Promise<Conversation | null | 'forbidden'> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conversation) return null
  const ownsIt =
    (user.role === 'TEACHER' && conversation.teacherId === user.id) ||
    (user.role === 'STUDENT' && conversation.studentId === user.id)
  return ownsIt ? conversation : 'forbidden'
}

export interface ConversationSummary {
  id: string
  otherId: string
  otherName: string
  otherAvatarUrl: string | null
  createdAt: Date
  lastMessageAt: Date
  lastMessage: {
    text: string | null
    attachmentType: string | null
    eventType: string | null
    senderRole: Role
    createdAt: Date
  } | null
  unreadCount: number
}

/** Builds the list-item / get-or-create shape shared by GET and POST /conversations. */
export async function buildConversationSummary(
  conversation: Conversation,
  meRole: ChatRole
): Promise<ConversationSummary> {
  const isTeacher = meRole === 'TEACHER'
  const otherId = isTeacher ? conversation.studentId : conversation.teacherId

  const [other, lastMessage, unreadCount] = await Promise.all([
    isTeacher
      ? prisma.student.findUnique({ where: { id: otherId }, select: { id: true, name: true, avatarUrl: true } })
      : prisma.teacher.findUnique({ where: { id: otherId }, select: { id: true, name: true, avatarUrl: true } }),
    prisma.chatMessage.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      select: { text: true, attachmentType: true, eventType: true, senderRole: true, createdAt: true },
    }),
    prisma.chatMessage.count({
      where: { conversationId: conversation.id, isRead: false, senderRole: otherRole(meRole) },
    }),
  ])

  return {
    id: conversation.id,
    otherId,
    otherName: other?.name ?? '',
    otherAvatarUrl: other?.avatarUrl ?? null,
    createdAt: conversation.createdAt,
    lastMessageAt: conversation.lastMessageAt,
    lastMessage,
    unreadCount,
  }
}
