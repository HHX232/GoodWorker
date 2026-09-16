'use client'

import { MessageBubble } from '@/widgets/Chat/MessageBubble/MessageBubble'
import type { ChatMessage, ConversationSummary } from '@/shared/types/Chat/chat.types'
import { getAvatarColor } from '@/shared/ui/User/UserHeaderCard/UserHeaderCard'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import styles from './ConversationView.module.scss'

/**
 * Public contract for the widget `ChatShell` (ticket 02) plugs into
 * `renderConversation`. See "Контракт ChatWidget" in
 * `.autopilot/chat-system/interfaces.md`.
 */
export interface ConversationViewProps {
  conversation: ConversationSummary
  onBack: () => void
}

const POLL_INTERVAL_MS = 3000
const TEXTAREA_MAX_HEIGHT = 120

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0014 0v-1M12 18v4M8 22h8" />
    </svg>
  )
}

function ChatPlaceholderIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}

/** Merges a freshly-fetched page of messages into the existing list, deduped by id. */
function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map(m => [m.id, m]))
  let changed = false
  for (const m of incoming) {
    if (!byId.has(m.id)) changed = true
    byId.set(m.id, m)
  }
  if (!changed) return prev
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * The right-hand panel of the chat: message history, empty-state invite,
 * and the text composer (textarea → attach stub → voice stub → send).
 * Fetches history on mount/conversation change, sends via
 * `POST .../messages`, and polls `GET .../messages` every 3s while the tab
 * is visible so incoming messages show up without a manual refresh.
 */
export function ConversationView({ conversation, onBack }: ConversationViewProps) {
  const t = useTranslations('chat')
  const { data: session, status: sessionStatus } = useSession()
  const myRole = session?.user?.role === 'STUDENT' ? 'STUDENT' : 'TEACHER'

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loading = historyLoading || sessionStatus === 'loading'

  // Load history whenever the selected conversation changes; also marks the
  // conversation read (best-effort, doesn't block or affect this widget's
  // own state — feeds the unread badge elsewhere in the app).
  useEffect(() => {
    let cancelled = false
    setHistoryLoading(true)
    setLoadError(false)
    setMessages([])
    setDraft('')
    setSendError(false)

    fetch(`/api/chat/conversations/${conversation.id}/messages`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ messages: ChatMessage[] }>
      })
      .then(data => {
        if (cancelled) return
        setMessages(data.messages)
      })
      .catch(e => {
        console.error('[ConversationView] load history failed', e)
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    fetch(`/api/chat/conversations/${conversation.id}/read`, { method: 'PATCH' }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [conversation.id])

  // Poll for new messages every 3s, skipped entirely while the tab is
  // hidden (no request is even sent) so a backgrounded tab stays idle.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return

      fetch(`/api/chat/conversations/${conversation.id}/messages`)
        .then(res => (res.ok ? (res.json() as Promise<{ messages: ChatMessage[] }>) : null))
        .then(data => {
          if (!data) return
          setMessages(prev => mergeMessages(prev, data.messages))
        })
        .catch(e => console.error('[ConversationView] poll failed', e))

      fetch(`/api/chat/conversations/${conversation.id}/read`, { method: 'PATCH' }).catch(() => {})
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [conversation.id])

  // Keep the list pinned to the newest message.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, conversation.id])

  // Auto-grow the textarea up to a capped height.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }, [draft])

  const canSend = draft.trim().length > 0 && !sending

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    setSendError(false)

    fetch(`/api/chat/conversations/${conversation.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ message: ChatMessage }>
      })
      .then(data => {
        setMessages(prev => (prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]))
        setDraft('')
      })
      .catch(e => {
        console.error('[ConversationView] send failed', e)
        setSendError(true)
      })
      .finally(() => setSending(false))
  }, [draft, sending, conversation.id])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const { bg, text: avatarText } = getAvatarColor(conversation.otherName)
  const letter = conversation.otherName.trim()[0]?.toUpperCase() ?? '?'

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label={t('back')}>
          <BackIcon />
        </button>
        <div
          className={styles.avatar}
          style={conversation.otherAvatarUrl ? undefined : { background: bg, color: avatarText }}
        >
          {conversation.otherAvatarUrl ? (
            <Image src={conversation.otherAvatarUrl} alt="" width={36} height={36} className={styles.avatarImg} unoptimized />
          ) : (
            letter
          )}
        </div>
        <span className={styles.headerName}>{conversation.otherName}</span>
      </div>

      <div className={styles.list} ref={listRef}>
        {loading && <div className={styles.stateMsg}>{t('loading')}</div>}

        {!loading && loadError && <div className={styles.stateMsg}>{t('conversationLoadError')}</div>}

        {!loading && !loadError && messages.length === 0 && (
          <div className={styles.emptyState}>
            <ChatPlaceholderIcon />
            <p>{t('conversationEmpty')}</p>
          </div>
        )}

        {!loading &&
          !loadError &&
          messages.map(message => (
            <MessageBubble key={message.id} message={message} isMine={message.senderRole === myRole} />
          ))}
      </div>

      <div className={styles.composer}>
        {sendError && <div className={styles.sendError}>{t('sendError')}</div>}

        <div className={styles.composerRow}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={t('composerPlaceholder')}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
          />
          <button type="button" className={styles.iconBtn} aria-label={t('attach')}>
            <PaperclipIcon />
          </button>
          <button type="button" className={styles.iconBtn} aria-label={t('voice')}>
            <MicIcon />
          </button>
          <button
            type="button"
            className={styles.sendBtn}
            aria-label={t('send')}
            disabled={!canSend}
            onClick={handleSend}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
