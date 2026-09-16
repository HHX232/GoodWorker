import { prisma } from '@/shared/prisma/prisma'
import type { Conversation, Role } from '@prisma/client'
import { NextResponse } from 'next/server'
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

/**
 * Which `Conversation` column is "mine" vs "the other side's" for a given
 * role — the one fact every list/lookup/count query below needs, so it's
 * computed in exactly one place instead of a `role === 'TEACHER' ? ... : ...`
 * repeated at each call site.
 */
export function fieldsForRole(role: ChatRole): { mine: 'teacherId' | 'studentId'; other: 'teacherId' | 'studentId' } {
  return role === 'TEACHER' ? { mine: 'teacherId', other: 'studentId' } : { mine: 'studentId', other: 'teacherId' }
}

/** Prisma `where` fragment selecting every conversation that belongs to this user. */
export function conversationWhereForUser(user: ChatSessionUser): { teacherId: string } | { studentId: string } {
  return user.role === 'TEACHER' ? { teacherId: user.id } : { studentId: user.id }
}

/** The `{teacherId, studentId}` pair for a conversation between the current user and `otherId`. */
export function conversationIdsForPair(user: ChatSessionUser, otherId: string): { teacherId: string; studentId: string } {
  return user.role === 'TEACHER' ? { teacherId: user.id, studentId: otherId } : { teacherId: otherId, studentId: user.id }
}

export async function hasTeacherStudentLink(teacherId: string, studentId: string): Promise<boolean> {
  const link = await prisma.teacherStudent.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
  })
  return !!link
}

type OwnedConversationResult =
  | { ok: true; conversation: Conversation }
  | { ok: false; status: 404 | 403 }

/**
 * Loads a conversation and verifies the current user is one of its two
 * sides. A discriminated result (`ok: true/false`) rather than a bare
 * `null | 'forbidden'` sentinel — a typo in a string literal can't silently
 * pass as "found" this way; TypeScript forces the `ok` check first.
 */
async function getOwnedConversation(conversationId: string, user: ChatSessionUser): Promise<OwnedConversationResult> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conversation) return { ok: false, status: 404 }
  const { mine } = fieldsForRole(user.role)
  const ownsIt = conversation[mine] === user.id
  return ownsIt ? { ok: true, conversation } : { ok: false, status: 403 }
}

const STATUS_MESSAGE: Record<404 | 403, string> = { 404: 'Not found', 403: 'Forbidden' }

/**
 * One-call guard for every route that operates on an existing conversation:
 * returns the conversation when the current user owns it, or an
 * already-built `NextResponse` (404/403) to return as-is otherwise — the
 * caller does a single check instead of duplicating the not-found/forbidden
 * branching itself.
 */
export async function requireOwnedConversation(
  conversationId: string,
  user: ChatSessionUser
): Promise<{ conversation: Conversation; response?: undefined } | { conversation?: undefined; response: NextResponse }> {
  const result = await getOwnedConversation(conversationId, user)
  if (result.ok) return { conversation: result.conversation }
  return { response: NextResponse.json({ error: STATUS_MESSAGE[result.status] }, { status: result.status }) }
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
  const { other } = fieldsForRole(meRole)
  const otherId = conversation[other]

  const [otherParty, lastMessage, unreadCount] = await Promise.all([
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
    otherName: otherParty?.name ?? '',
    otherAvatarUrl: otherParty?.avatarUrl ?? null,
    createdAt: conversation.createdAt,
    lastMessageAt: conversation.lastMessageAt,
    lastMessage,
    unreadCount,
  }
}
