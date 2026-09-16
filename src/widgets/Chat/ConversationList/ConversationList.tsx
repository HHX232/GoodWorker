'use client'

import type { ConversationSummary } from '@/shared/types/Chat/chat.types'
import { getAvatarColor } from '@/shared/ui/User/UserHeaderCard/UserHeaderCard'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import styles from './ConversationList.module.scss'

export interface ConversationListProps {
  conversations: ConversationSummary[]
  loading: boolean
  loadError?: boolean
  selectedConversationId: string | null
  onSelect: (conversation: ConversationSummary) => void
}

function previewText(
  conversation: ConversationSummary,
  t: ReturnType<typeof useTranslations>
): string | null {
  const last = conversation.lastMessage
  if (!last) return null
  if (last.eventType) return t('eventMessage')
  if (last.text) return last.text
  if (last.attachmentType) return t('attachmentMessage')
  return null
}

function formatListTime(iso: string, locale: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  try {
    if (sameDay) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  } catch (e) {
    console.error('[ConversationList] formatListTime failed', { iso, locale, error: e })
    return ''
  }
}

export function ConversationList({
  conversations,
  loading,
  loadError = false,
  selectedConversationId,
  onSelect,
}: ConversationListProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => c.otherName.toLowerCase().includes(q))
  }, [conversations, search])

  const showEmptyAtAll = !loading && !loadError && conversations.length === 0
  const showNoResults = !loading && !loadError && conversations.length > 0 && filtered.length === 0

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{t('title')}</span>
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className={styles.search}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.list}>
        {loading && <div className={styles.stateMsg}>{t('loading')}</div>}

        {!loading && loadError && <div className={styles.stateMsg}>{t('loadError')}</div>}

        {showEmptyAtAll && (
          <div className={styles.emptyState}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            <p>{t('empty')}</p>
          </div>
        )}

        {showNoResults && (
          <div className={styles.emptyState}>
            <p>{t('noResults')}</p>
          </div>
        )}

        {!loading && !loadError && filtered.map(conversation => {
          const { bg, text } = getAvatarColor(conversation.otherName)
          const letter = conversation.otherName.trim()[0]?.toUpperCase() ?? '?'
          const preview = previewText(conversation, t)
          const isActive = conversation.id === selectedConversationId

          return (
            <button
              key={conversation.id}
              type="button"
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
              onClick={() => onSelect(conversation)}
            >
              <div className={styles.avatar} style={conversation.otherAvatarUrl ? undefined : { background: bg, color: text }}>
                {conversation.otherAvatarUrl ? (
                  <Image src={conversation.otherAvatarUrl} alt="" width={44} height={44} className={styles.avatarImg} unoptimized />
                ) : (
                  letter
                )}
              </div>

              <div className={styles.itemBody}>
                <div className={styles.itemTopRow}>
                  <span className={styles.itemName}>{conversation.otherName}</span>
                  {conversation.lastMessage && (
                    <span className={styles.itemTime}>{formatListTime(conversation.lastMessage.createdAt, locale)}</span>
                  )}
                </div>
                <div className={styles.itemBottomRow}>
                  <span className={styles.itemPreview}>{preview ?? t('noMessages')}</span>
                  {conversation.unreadCount > 0 && (
                    <span className={styles.unreadBadge}>{conversation.unreadCount}</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
