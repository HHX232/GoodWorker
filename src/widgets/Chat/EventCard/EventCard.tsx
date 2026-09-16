'use client'

import type { ChatMessage } from '@/shared/types/Chat/chat.types'
import { ChatEventIcon, ChatHomeworkIcon, ChatPaymentIcon, ChatServiceIcon } from '@/widgets/Chat/icons'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { ComponentType, ReactNode } from 'react'
import styles from './EventCard.module.scss'

type EventKind = 'homework' | 'service' | 'payment' | 'unknown'

/** One accent per event type — the card's only "status" signal besides the
 * unread dot, so each type stays visually findable in a scrolling history
 * without leaning on color alone (icon shape differs too). */
const KIND_BY_EVENT_TYPE: Record<string, EventKind> = {
  HOMEWORK_ASSIGNED: 'homework',
  PERSONAL_SERVICE: 'service',
  PAYMENT_REMINDER: 'payment',
}

const ICON_BY_KIND: Record<EventKind, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  homework: ChatHomeworkIcon,
  service: ChatServiceIcon,
  payment: ChatPaymentIcon,
  unknown: ChatEventIcon,
}

export interface EventCardProps {
  message: ChatMessage
  /** True when `message.senderRole` is the current viewer's own role — event
   * cards are always teacher-sent, so this is `false` exactly when the
   * viewer is the recipient, which is the only side the unread dot means
   * anything to. */
  isMine: boolean
}

interface HomeworkAssignedPayload {
  homeworkId?: string
  assignmentId?: string
  title?: string
  dueAt?: string | null
}

interface PersonalServicePayload {
  serviceId?: string
  serviceTitle?: string
  price?: number
  currency?: string
}

interface PaymentReminderTotal {
  currency?: string
  amount?: number
}

interface PaymentReminderPayload {
  teacherName?: string
  unpaidCount?: number
  totals?: PaymentReminderTotal[]
}

function formatSentTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    console.error('[EventCard] formatSentTime failed', { iso, locale, error: e })
    return ''
  }
}

function formatDueDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    console.error('[EventCard] formatDueDate failed', { iso, locale, error: e })
    return null
  }
}

/** `120 BYN + 40 USD` / `0` — mirrors the join used for the sibling Telegram text
 * in `tg-bot/src/scheduler.ts` (`sendPaymentReminders`). */
function formatTotals(totals: PaymentReminderTotal[] | undefined): string {
  if (!Array.isArray(totals) || totals.length === 0) return '0'
  const parts = totals
    .filter((t): t is PaymentReminderTotal => !!t && typeof t.amount === 'number')
    .map(t => `${t.amount} ${t.currency ?? ''}`.trim())
  return parts.length > 0 ? parts.join(' + ') : '0'
}

/**
 * Renders a `ChatMessage` with a non-empty `eventType` as a distinct card —
 * icon + title + short description, an optional info chip (due date / price /
 * amount owed), and (only for `HOMEWORK_ASSIGNED`) a link to the assignment —
 * instead of the plain text/attachment bubble body. Ticket 05 (R13–R15):
 * plugs into `MessageBubble`'s eventType branch without changing
 * `MessageBubbleProps`. `eventPayload` comes back from Prisma as untyped
 * `Json`, so every field is read defensively with a fallback — a
 * malformed/older payload degrades the card's text instead of crashing it.
 */
export function EventCard({ message, isMine }: EventCardProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const payload = (message.eventPayload ?? {}) as Record<string, unknown>

  const kind = KIND_BY_EVENT_TYPE[message.eventType ?? ''] ?? 'unknown'
  const Icon = ICON_BY_KIND[kind]

  let title: ReactNode
  let description: ReactNode = null
  let chip: ReactNode = null
  let link: ReactNode = null

  if (message.eventType === 'HOMEWORK_ASSIGNED') {
    const p = payload as HomeworkAssignedPayload
    const due = formatDueDate(p.dueAt, locale)
    title = t('eventCard.homeworkTitle')
    description = t('eventCard.homeworkDescriptionNoDue', { title: p.title ?? '' })
    if (due) chip = due
    if (p.assignmentId) {
      link = (
        <Link href={`/homework/${p.assignmentId}`} className={styles.link}>
          {t('eventCard.homeworkLink')}
        </Link>
      )
    }
  } else if (message.eventType === 'PERSONAL_SERVICE') {
    const p = payload as PersonalServicePayload
    title = t('eventCard.serviceTitle')
    description = t('eventCard.serviceDescription', { title: p.serviceTitle ?? '' })
    if (typeof p.price === 'number') chip = `${p.price} ${p.currency ?? ''}`.trim()
  } else if (message.eventType === 'PAYMENT_REMINDER') {
    const p = payload as PaymentReminderPayload
    title = t('eventCard.paymentTitle')
    description = t('eventCard.paymentDescription', { count: p.unpaidCount ?? 0 })
    chip = formatTotals(p.totals)
  } else {
    // Unknown/future eventType — same non-crashing fallback ticket 03 shipped
    // for every eventType, kept here so a value this card doesn't know about
    // yet never breaks the bubble.
    title = t('eventMessage')
  }

  const time = formatSentTime(message.createdAt, locale)
  const isUnread = !isMine && !message.isRead

  return (
    <div className={`${styles.card} ${styles[kind]}`}>
      {isUnread && <span className={styles.unreadDot} aria-hidden="true" />}
      <span className={styles.icon}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className={styles.body}>
        <span className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          {isUnread && <span className={styles.newLabel}>{t('eventCard.new')}</span>}
        </span>
        {description && <span className={styles.description}>{description}</span>}
        {chip && <span className={styles.chip}>{chip}</span>}
        {link}
        {time && <span className={styles.time}>{time}</span>}
      </span>
    </div>
  )
}
