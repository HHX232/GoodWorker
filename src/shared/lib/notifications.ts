import { prisma } from '@/shared/prisma/prisma'
import { enrichNotificationWithAI } from '@/lib/postAI'

// ─── Notification event types ─────────────────────────────
export const NOTIFICATION_TYPES = {
  // Teacher receives
  NEW_COMPLAINT: 'NEW_COMPLAINT',
  NEW_STUDENT: 'NEW_STUDENT',
  ROADMAP_PURCHASE: 'ROADMAP_PURCHASE',
  NEW_COMMENT_ON_POST: 'NEW_COMMENT_ON_POST',
  NEW_REVIEW: 'NEW_REVIEW',
  // Reporter receives
  COMPLAINT_REPLIED: 'COMPLAINT_REPLIED',
  COMPLAINT_CLOSED: 'COMPLAINT_CLOSED',
  // Students receive
  NEW_POST: 'NEW_POST',
  // Video call invite
  VIDEO_CALL_INVITE: 'VIDEO_CALL_INVITE',
  // System broadcast (contains payload.html rendered as rich content)
  SYSTEM: 'SYSTEM',
  // Personal service offer from teacher to specific student
  PERSONAL_SERVICE: 'PERSONAL_SERVICE',
  // Booking response from teacher
  BOOKING_RESPONSE: 'BOOKING_RESPONSE',
  // Student booked a service
  SERVICE_BOOKING: 'SERVICE_BOOKING',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

// Default types enabled per role
export const DEFAULT_SUBSCRIPTIONS: Record<string, NotificationType[]> = {
  TEACHER: [
    NOTIFICATION_TYPES.NEW_COMPLAINT,
    NOTIFICATION_TYPES.NEW_STUDENT,
    NOTIFICATION_TYPES.ROADMAP_PURCHASE,
    NOTIFICATION_TYPES.NEW_COMMENT_ON_POST,
    NOTIFICATION_TYPES.NEW_REVIEW,
    NOTIFICATION_TYPES.VIDEO_CALL_INVITE,
    NOTIFICATION_TYPES.SYSTEM,
  ],
  STUDENT: [
    NOTIFICATION_TYPES.COMPLAINT_REPLIED,
    NOTIFICATION_TYPES.COMPLAINT_CLOSED,
    NOTIFICATION_TYPES.NEW_POST,
    NOTIFICATION_TYPES.VIDEO_CALL_INVITE,
    NOTIFICATION_TYPES.SYSTEM,
  ],
  ADMIN: Object.values(NOTIFICATION_TYPES) as NotificationType[],
}

// All known types (for building subscription list UI)
export const ALL_NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPES) as NotificationType[]

interface CreateNotificationInput {
  type: NotificationType
  title: string
  body: string
  payload?: Record<string, unknown>
  // Exactly one recipient
  teacherId?: string
  studentId?: string
}

// ─── Create a notification (always stored; display filtered by subscriptions) ─
export async function createNotification(input: CreateNotificationInput) {
  const recipientId = input.teacherId ?? input.studentId
  if (!recipientId) return

  const created = await prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ? JSON.parse(JSON.stringify(input.payload)) : undefined,
      isRead: false,
      teacherId: input.teacherId ?? null,
      studentId: input.studentId ?? null,
    },
  })

  enrichNotificationWithAI(created.id).catch(() => {})
}
