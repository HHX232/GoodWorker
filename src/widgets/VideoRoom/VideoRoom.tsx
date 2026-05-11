'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './VideoRoom.module.scss'

interface VideoRoomProps {
  defaultName: string
}

export default function VideoRoom({ defaultName: _ }: VideoRoomProps) {
  const router = useRouter()
  const [roomName, setRoomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const join = async () => {
    const name = roomName.trim()
    if (!name) return
    setLoading(true)
    setError('')
    try {
      await fetch('/api/call/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: name }),
      }).catch(() => null) // ignore network/parse errors — room is created on the page itself
      router.push(`/call/${encodeURIComponent(name)}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <h3 className={styles.headerTitle}>Видео-комната</h3>
      </div>

      <div className={styles.joinPane}>
        <div className={styles.joinField}>
          <label className={styles.joinLabel}>Название комнаты</label>
          <input
            className={styles.joinInput}
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Введите название комнаты..."
            onKeyDown={(e) => e.key === 'Enter' && join()}
            disabled={loading}
          />
          {error && <span style={{ fontSize: 12, color: '#e53e3e', marginTop: 4 }}>{error}</span>}
        </div>
        <button className={styles.joinBtn} onClick={join} disabled={!roomName.trim() || loading}>
          {loading ? (
            <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
            </svg>
          )}
          {loading ? 'Создаём...' : 'Войти в комнату'}
        </button>
      </div>
    </div>
  )
}
