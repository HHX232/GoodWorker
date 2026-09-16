'use client'

import { ConversationList } from '@/widgets/Chat/ConversationList/ConversationList'
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

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
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
                    <BackIcon />
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
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p>{t('emptyPlaceholder')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
