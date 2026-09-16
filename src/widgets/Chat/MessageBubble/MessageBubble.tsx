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

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13m0 0l-4-4m4 4l4-4M4 21h16" />
    </svg>
  )
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
 * file-with-download) are fully implemented; `eventType` messages still
 * render the minimal, non-crashing placeholder left for ticket 05 to
 * replace with real cards, without changing this component's props.
 */
export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const time = formatTime(message.createdAt, locale)

  /** Real rendering for `attachmentType` — image thumbnail, audio player, or a
   * generic file row with a download link — plus any caption text sent
   * alongside the attachment. */
  function renderAttachment(): ReactNode {
    const type = message.attachmentType ?? ''
    const url = message.attachmentUrl
    const name = message.attachmentName || t('attachmentMessage')

    let attachmentNode: ReactNode
    if (type.startsWith('image/') && url) {
      attachmentNode = (
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={message.attachmentName || t('imageAttachmentAlt')} className={styles.imageAttachment} />
        </a>
      )
    } else if (type.startsWith('audio/') && url) {
      attachmentNode = <audio controls src={url} className={styles.audioAttachment} />

    } else {
      const sizeLabel = formatAttachmentSize(message.attachmentSize)
      attachmentNode = (
        <a
          href={url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          download={message.attachmentName || undefined}
          className={styles.fileAttachment}
          aria-label={t('downloadAttachment')}
        >
          <span className={styles.fileAttachmentIcon}>
            <AttachmentIcon />
          </span>
          <span className={styles.fileAttachmentInfo}>
            <span className={styles.fileAttachmentName}>{name}</span>
            {sizeLabel && <span className={styles.fileAttachmentSize}>{sizeLabel}</span>}
          </span>
          <span className={styles.fileAttachmentDownload}>
            <DownloadIcon />
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

  let body: ReactNode
  if (message.eventType) {
    body = (
      <span className={styles.placeholderContent}>
        <EventIcon />
        {t('eventMessage')}
      </span>
    )
  } else if (message.attachmentType) {
    body = renderAttachment()
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
