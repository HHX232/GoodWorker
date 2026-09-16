'use client'

import type { ChatMessage } from '@/shared/types/Chat/chat.types'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import styles from './MessageBubble.module.scss'

/**
 * Public contract used by ticket 03 (this widget), and by tickets 04/05 —
 * both add real rendering for `attachmentType`/`eventType` messages behind
 * the same dispatcher, so their work plugs in here without touching
 * `ConversationView`. See "Контракт ChatWidget" in
 * `.autopilot/chat-system/interfaces.md`.
 */
export interface MessageBubbleProps {
  message: ChatMessage
  /** True when `message.senderRole` is the current viewer's own role. */
  isMine: boolean
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    console.error('[MessageBubble] formatTime failed', { iso, locale, error: e })
    return ''
  }
}

function AttachmentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function EventIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

/**
 * Dispatches a single `ChatMessage` to the bubble variant matching its type.
 * Only the `text` variant is fully implemented here — `attachmentType` and
 * `eventType` messages render a minimal, non-crashing placeholder; tickets
 * 04 (attachments) and 05 (event cards) replace those branches with real
 * previews/cards without changing this component's props.
 */
export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const time = formatTime(message.createdAt, locale)

  let body: ReactNode
  if (message.eventType) {
    body = (
      <span className={styles.placeholderContent}>
        <EventIcon />
        {t('eventMessage')}
      </span>
    )
  } else if (message.attachmentType) {
    body = (
      <span className={styles.placeholderContent}>
        <AttachmentIcon />
        {message.attachmentName || t('attachmentMessage')}
      </span>
    )
  } else {
    body = <span className={styles.text}>{message.text}</span>
  }

  return (
    <div className={`${styles.row} ${isMine ? styles.rowMine : styles.rowOther}`}>
      <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
        {body}
        {time && <span className={styles.time}>{time}</span>}
      </div>
    </div>
  )
}
