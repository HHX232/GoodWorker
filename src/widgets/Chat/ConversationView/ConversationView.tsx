'use client'

import { MessageBubble } from '@/widgets/Chat/MessageBubble/MessageBubble'
import {
  ChatBackIcon,
  ChatAttachIcon,
  ChatMicIcon,
  ChatStopIcon,
  ChatCloseIcon,
  ChatBubbleIcon,
  ChatSendIcon,
} from '@/widgets/Chat/icons'
import type { ChatMessage, ConversationSummary } from '@/shared/types/Chat/chat.types'
import { getAvatarColor } from '@/shared/ui/User/UserHeaderCard/UserHeaderCard'
import { compressImageForUpload } from '@/shared/helpers/compressImageForUpload'
import { uploadFile } from '@/shared/lib/uploadFile'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { toast } from 'sonner'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
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
// Mirrors the server-side `MAX_ATTACHMENT_BYTES` in `src/shared/lib/chat/access.ts`
// (ticket 01) — checked here too so the client never even attempts an upload
// it knows the server will reject with "Attachment exceeds 10MB limit".
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

type PendingAttachmentKind = 'image' | 'file'

interface PendingAttachment {
  kind: PendingAttachmentKind
  /** Already compressed (for images) — this is exactly what gets uploaded. */
  file: File
  /** Object URL for the thumbnail preview; only set for images. */
  previewUrl: string | null
  name: string
  size: number
  mimeType: string
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

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Picks a filename extension matching a `MediaRecorder`-produced mime type. */
function extForRecordingMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

/**
 * The right-hand panel of the chat: message history, empty-state invite,
 * and the text composer (textarea → attach → voice → send). Fetches
 * history on mount/conversation change, sends via `POST .../messages`, and
 * polls `GET .../messages` every 3s while the tab is visible so incoming
 * messages show up without a manual refresh.
 *
 * Attachments (ticket 04): the attach button stages a file (compressing
 * images client-side via `compressImageForUpload`) into a preview shown
 * above the composer; the existing Send button then uploads it
 * (`uploadFile(..., 'chat')`) and posts the message. The voice button
 * records via `MediaRecorder` and — on stop — uploads/sends immediately
 * as an audio attachment, no separate review step (matches the brief:
 * "остановка → отправка").
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

  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [preparingAttachment, setPreparingAttachment] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingAttachmentRef = useRef<PendingAttachment | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loading = historyLoading || sessionStatus === 'loading'

  useEffect(() => {
    pendingAttachmentRef.current = pendingAttachment
  }, [pendingAttachment])

  const clearPendingAttachment = useCallback(() => {
    setPendingAttachment(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }, [])

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
    if (pendingAttachmentRef.current?.previewUrl) URL.revokeObjectURL(pendingAttachmentRef.current.previewUrl)
    setPendingAttachment(null)

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

  // Stop any in-flight recording when the conversation changes or the view
  // unmounts, so switching chats mid-recording doesn't leak the mic stream
  // or fire off a stray send for the wrong conversation.
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.stop()
      }
      recordingStreamRef.current?.getTracks().forEach(track => track.stop())
      recordingStreamRef.current = null
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      recordedChunksRef.current = []
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

  const canSend = (draft.trim().length > 0 || !!pendingAttachment) && !sending && !preparingAttachment

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text && !pendingAttachment) return
    if (sending) return

    const attachment = pendingAttachment

    setSending(true)
    setSendError(false)

    const doSend = async (): Promise<{ message: ChatMessage }> => {
      let attachmentUrl: string | undefined
      let attachmentSize: number | undefined

      if (attachment) {
        // Belt-and-suspenders: already checked when staged, but re-check in
        // case something upstream changed the file reference.
        if (attachment.file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(t('attachTooBig'))
          throw new Error('attachment-too-big')
        }
        try {
          attachmentUrl = await uploadFile(attachment.file, 'chat')
        } catch (uploadErr) {
          console.error('[ConversationView] attachment upload failed', uploadErr)
          toast.error(t('attachUploadError'))
          throw uploadErr
        }
        attachmentSize = attachment.file.size
      }

      const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text || undefined,
          ...(attachment
            ? {
                attachmentUrl,
                attachmentType: attachment.mimeType,
                attachmentName: attachment.name,
                attachmentSize,
              }
            : {}),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{ message: ChatMessage }>
    }

    doSend()
      .then(data => {
        setMessages(prev => (prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]))
        setDraft('')
        clearPendingAttachment()
      })
      .catch(e => {
        if ((e as Error).message !== 'attachment-too-big') {
          console.error('[ConversationView] send failed', e)
          setSendError(true)
        }
      })
      .finally(() => setSending(false))
  }, [draft, sending, pendingAttachment, conversation.id, t, clearPendingAttachment])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleAttachClick = useCallback(() => {
    if (sending || preparingAttachment || recording) return
    fileInputRef.current?.click()
  }, [sending, preparingAttachment, recording])

  const handleFileSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return

      const isImage = file.type.startsWith('image/')
      setPreparingAttachment(true)
      try {
        if (isImage) {
          const compressed = await compressImageForUpload(file)
          if (compressed.size > MAX_ATTACHMENT_BYTES) {
            toast.error(t('attachTooBig'))
            return
          }
          const previewUrl = URL.createObjectURL(compressed)
          clearPendingAttachment()
          setPendingAttachment({
            kind: 'image',
            file: compressed,
            previewUrl,
            name: file.name,
            size: compressed.size,
            mimeType: compressed.type,
          })
        } else {
          if (file.size > MAX_ATTACHMENT_BYTES) {
            toast.error(t('attachTooBig'))
            return
          }
          clearPendingAttachment()
          setPendingAttachment({
            kind: 'file',
            file,
            previewUrl: null,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
          })
        }
      } catch (err) {
        console.error('[ConversationView] attachment prep failed', err)
        toast.error(t('attachUploadError'))
      } finally {
        setPreparingAttachment(false)
      }
    },
    [t, clearPendingAttachment]
  )

  const sendVoiceMessage = useCallback(
    (blob: Blob, mimeType: string) => {
      if (blob.size > MAX_ATTACHMENT_BYTES) {
        toast.error(t('attachTooBig'))
        return
      }

      const file = new File([blob], `voice-${Date.now()}.${extForRecordingMime(mimeType)}`, { type: mimeType })
      setSending(true)
      setSendError(false)

      uploadFile(file, 'chat')
        .then(url =>
          fetch(`/api/chat/conversations/${conversation.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attachmentUrl: url,
              attachmentType: mimeType,
              attachmentName: t('voiceMessageName'),
              attachmentSize: file.size,
            }),
          })
        )
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<{ message: ChatMessage }>
        })
        .then(data => {
          setMessages(prev => (prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]))
        })
        .catch(e => {
          console.error('[ConversationView] voice send failed', e)
          toast.error(t('attachUploadError'))
          setSendError(true)
        })
        .finally(() => setSending(false))
    },
    [conversation.id, t]
  )

  const handleMicClick = useCallback(async () => {
    if (sending || preparingAttachment) return

    if (recording) {
      mediaRecorderRef.current?.stop()
      return
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error(t('micDenied'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream
      recordedChunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        setRecording(false)
        setRecordingSeconds(0)
        recordingStreamRef.current?.getTracks().forEach(track => track.stop())
        recordingStreamRef.current = null

        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        recordedChunksRef.current = []

        if (blob.size === 0) return // recording too short / cancelled before any data

        sendVoiceMessage(blob, mimeType)
      }

      recorder.start()
      setRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch (err) {
      console.error('[ConversationView] mic access failed', err)
      toast.error(t('micDenied'))
    }
  }, [recording, sending, preparingAttachment, sendVoiceMessage, t])

  const { bg, text: avatarText } = getAvatarColor(conversation.otherName)
  const letter = conversation.otherName.trim()[0]?.toUpperCase() ?? '?'

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label={t('back')}>
          <ChatBackIcon size={18} strokeWidth={2} />
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
            <ChatBubbleIcon size={34} strokeWidth={1.5} />
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

        {pendingAttachment && (
          <div className={styles.attachmentPreview}>
            {pendingAttachment.kind === 'image' && pendingAttachment.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pendingAttachment.previewUrl} alt="" className={styles.attachmentPreviewImg} />
            ) : (
              <span className={styles.attachmentPreviewIcon}>
                <ChatAttachIcon size={18} strokeWidth={2} />
              </span>
            )}
            <span className={styles.attachmentPreviewName} title={pendingAttachment.name}>
              {pendingAttachment.name}
            </span>
            <button
              type="button"
              className={styles.attachmentPreviewRemove}
              onClick={clearPendingAttachment}
              aria-label={t('removeAttachment')}
              disabled={sending}
            >
              <ChatCloseIcon size={14} strokeWidth={2} />
            </button>
          </div>
        )}

        {recording && (
          <div className={styles.recordingBar}>
            <span className={styles.recordingDot} />
            <span>{t('recordingIndicator')}</span>
            <span className={styles.recordingTime}>{formatDuration(recordingSeconds)}</span>
          </div>
        )}

        <div className={styles.composerRow}>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.hiddenFileInput}
            onChange={handleFileSelected}
            tabIndex={-1}
          />
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={t('composerPlaceholder')}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending || recording}
          />
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('attach')}
            onClick={handleAttachClick}
            disabled={sending || preparingAttachment || recording}
          >
            <ChatAttachIcon size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${recording ? styles.iconBtnRecording : ''}`}
            aria-label={recording ? t('stopRecording') : t('voice')}
            onClick={handleMicClick}
            disabled={sending || preparingAttachment}
          >
            {recording ? (
              <ChatStopIcon size={14} fill="currentColor" stroke="none" />
            ) : (
              <ChatMicIcon size={18} strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            className={styles.sendBtn}
            aria-label={t('send')}
            disabled={!canSend}
            onClick={handleSend}
          >
            <ChatSendIcon size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
