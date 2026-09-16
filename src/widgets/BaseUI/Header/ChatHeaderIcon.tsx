'use client'

import { ChatBubbleIcon } from '@/widgets/Chat/icons'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import styles from './ChatHeaderIcon.module.scss'

// Entry point 4/4 of the chat-system ticket (см. .autopilot/chat-system/tickets/06-entry-points.md):
// a chat icon right of NotificationBell, badge = sum of unread messages
// across every conversation, for both TEACHER and STUDENT sessions —
// GET /api/chat/unread-count already scopes by role server-side.
export function ChatHeaderIcon() {
  const { data: session } = useSession()
  const t = useTranslations('chat')
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/chat/unread-count')
      if (!res.ok) return
      const data = await res.json()
      setUnread(typeof data.count === 'number' ? data.count : 0)
    } catch {
      // ignore — badge just stays at its last known value
    }
  }, [session?.user])

  useEffect(() => {
    if (!session?.user) return
    fetchUnread()
    const interval = setInterval(fetchUnread, 15_000)
    return () => clearInterval(interval)
  }, [fetchUnread, session?.user])

  if (!session?.user) return null

  return (
    <Link href="/chats" className={styles.btn} aria-label={t('title')}>
      <ChatBubbleIcon size={18} strokeWidth={2} />

      {unread > 0 && (
        <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>
      )}
    </Link>
  )
}
