'use client'

import type { ChatMessage } from '@/shared/types/Chat/chat.types'
import { EventCard } from '@/widgets/Chat/EventCard/EventCard'
import { ChatAttachIcon, ChatDownloadIcon } from '@/widgets/Chat/icons'
import { VoiceMessagePlayer } from '@/widgets/Chat/VoiceMessagePlayer/VoiceMessagePlayer'
import { useLocale, useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'
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

/** `1.2 MB` / `340 KB` / `812 B` — mirrors `formatSize` in `InfoFileListEditor`. */
function formatAttachmentSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Dispatches a single `ChatMessage` to the bubble variant matching its type.
 * `text` and `attachmentType` (ticket 04 — image preview / audio player /
 * file-with-download) render the usual bubble shell; `eventType` (ticket 05,
 * R13–R15) renders `EventCard` instead of a bubble entirely — a visibly
 * different shape (icon + title + description card), not just different
 * bubble contents. None of this changes `MessageBubbleProps`.
 */
export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const time = formatTime(message.createdAt, locale)
  const [imageLoaded, setImageLoaded] = useState(false)

  /** Real rendering for `attachmentType` — image thumbnail, waveform voice
   * player, or a generic file row with a download link — plus any caption
   * text sent alongside the attachment. */
  function renderAttachment(): ReactNode {
    const type = message.attachmentType ?? ''
    const url = message.attachmentUrl
    const name = message.attachmentName || t('attachmentMessage')
    const fileClass = `${styles.fileAttachment} ${isMine ? styles.fileAttachmentMine : styles.fileAttachmentOther}`

    let attachmentNode: ReactNode
    if (type.startsWith('image/') && url) {
      attachmentNode = (
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
          <span className={styles.imageFrame}>
            {!imageLoaded && <span className={styles.imageSkeleton} aria-hidden="true" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={message.attachmentName || t('imageAttachmentAlt')}
              className={styles.imageAttachment}
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </span>
        </a>
      )
    } else if (type.startsWith('audio/') && url) {
      attachmentNode = <VoiceMessagePlayer url={url} isMine={isMine} />
    } else {
      const sizeLabel = formatAttachmentSize(message.attachmentSize)
      attachmentNode = (
        <a
          href={url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          download={message.attachmentName || undefined}
          className={fileClass}
          aria-label={t('downloadAttachment')}
        >
          <span className={styles.fileAttachmentIcon}>
            <ChatAttachIcon size={16} strokeWidth={2} />
          </span>
          <span className={styles.fileAttachmentInfo}>
            <span className={styles.fileAttachmentName}>{name}</span>
            {sizeLabel && <span className={styles.fileAttachmentSize}>{sizeLabel}</span>}
          </span>
          <span className={styles.fileAttachmentDownload}>
            <ChatDownloadIcon size={14} strokeWidth={2} />
          </span>
        </a>
      )
    }

    return (
      <span className={styles.attachmentContent}>
        {attachmentNode}
        {message.text && <span className={styles.text}>{message.text}</span>}
      </span>
    )
  }

  // Event messages (R13–R15) render as a distinct card — icon, title,
  // description, and (HOMEWORK_ASSIGNED only) a link — not the text/attachment
  // bubble shell, so they read visibly differently from a regular message.
  if (message.eventType) {
    return (
      <div className={`${styles.row} ${isMine ? styles.rowMine : styles.rowOther}`}>
        <EventCard message={message} isMine={isMine} />
      </div>
    )
  }

  const body: ReactNode = message.attachmentType
    ? renderAttachment()
    : <span className={styles.text}>{message.text}</span>

  return (
    <div className={`${styles.row} ${isMine ? styles.rowMine : styles.rowOther}`}>
      <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
        {body}
        {time && <span className={styles.time}>{time}</span>}
      </div>
    </div>
  )
}
