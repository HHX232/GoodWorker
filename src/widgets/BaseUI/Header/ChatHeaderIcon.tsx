'use client'

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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>

      {unread > 0 && (
        <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>
      )}
    </Link>
  )
}
