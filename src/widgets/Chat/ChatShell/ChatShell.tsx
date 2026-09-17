'use client'

import { ConversationList } from '@/widgets/Chat/ConversationList/ConversationList'
import { ChatBackIcon, ChatSquareBubbleIcon } from '@/widgets/Chat/icons'
import type { ConversationSummary } from '@/shared/types/Chat/chat.types'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './ChatShell.module.scss'

/**
 * Props handed to whatever renders inside the right-hand panel once a
 * conversation is selected. See "Контракт ChatWidget" in
 * `.autopilot/chat-system/interfaces.md` for the frozen contract — ticket 03
 * plugs its dialog component in via `renderConversation`.
 */
export interface ChatConversationSlotProps {
  conversation: ConversationSummary
  onBack: () => void
}

export interface ChatShellProps {
  /**
   * Renders the right-hand panel for the currently selected conversation.
   * Omitted (or returning nothing) falls back to a "select a conversation"
   * placeholder — this is the state ticket 02 ships in; ticket 03 passes a
   * real implementation here.
   */
  renderConversation?: (slot: ChatConversationSlotProps) => ReactNode
  /**
   * Pre-selects a conversation by id once the list finishes its first load —
   * backs the `/chats?conversationId=<id>` deep link `ChatEntryPoints` (T06)
   * navigates to after a get-or-create. Applied at most once (a later change
   * to this prop doesn't re-steal the user's own selection). If no
   * conversation with this id turns up in the list (e.g. it was just created
   * and the list hasn't caught up), this is a no-op — falls back to the
   * ordinary "select a conversation" state instead of crashing.
   */
  initialConversationId?: string
}

export function ChatShell({ renderConversation, initialConversationId }: ChatShellProps) {
  const t = useTranslations('chat')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const appliedInitialSelection = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)

    fetch('/api/chat/conversations')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ conversations: ConversationSummary[] }>
      })
      .then(data => {
        if (cancelled) return
        setConversations(data.conversations)
        if (!appliedInitialSelection.current && initialConversationId) {
          appliedInitialSelection.current = true
          const match = data.conversations.find(c => c.id === initialConversationId)
          if (match) setSelectedId(match.id)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [initialConversationId])

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedId) ?? null,
    [conversations, selectedId]
  )

  const handleSelect = useCallback((conversation: ConversationSummary) => {
    setSelectedId(conversation.id)
  }, [])

  const handleBack = useCallback(() => setSelectedId(null), [])

  const mobileView = selectedConversation ? 'conversation' : 'list'

  // `.page`'s height is "100vh minus the site header" — hardcoding that
  // offset as a fixed 83px (matching the header's single-row desktop height)
  // silently breaks the moment the header wraps to a second row, which it
  // does under ~600px width (search/nav collapsing under the logo row):
  // `.page` then claims more height than is actually left under the header,
  // pushing the composer below the viewport with no way to reach it (found
  // via a real 375px-viewport check — textarea rendered 45px past the
  // bottom edge). Measuring the real header live removes the guess entirely
  // and keeps working if the header's own height changes for any reason.
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return

    const applyHeight = () => {
      document.documentElement.style.setProperty('--chat-header-height', `${header.getBoundingClientRect().height}px`)
    }
    applyHeight()

    const observer = new ResizeObserver(applyHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.container} data-mobile-view={mobileView}>
        <div className={styles.listPanel}>
          <ConversationList
            conversations={conversations}
            loading={loading}
            loadError={loadError}
            selectedConversationId={selectedId}
            onSelect={handleSelect}
          />
        </div>

        <div className={styles.conversationPanel}>
          {selectedConversation ? (
            renderConversation ? (
              renderConversation({ conversation: selectedConversation, onBack: handleBack })
            ) : (
              <div className={styles.placeholder}>
                <div className={styles.placeholderHeader}>
                  <button type="button" className={styles.backBtn} onClick={handleBack} aria-label={t('back')}>
                    <ChatBackIcon size={18} strokeWidth={2} />
                  </button>
                  <span className={styles.placeholderHeaderName}>{selectedConversation.otherName}</span>
                </div>
                <div className={styles.placeholderBody}>
                  <p>{t('selectedPlaceholder', { name: selectedConversation.otherName })}</p>
                </div>
              </div>
            )
          ) : (
            <div className={styles.emptySlot}>
              <ChatSquareBubbleIcon size={40} strokeWidth={1.5} />
              <p>{t('emptyPlaceholder')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
