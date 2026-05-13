'use client'

import { useEffect, useState } from 'react'
import styles from './TranscriptsModal.module.scss'

interface TranscriptRoom {
  id: string
  name: string
  topic?: string | null
  createdAt: string
  endedAt: string | null
  transcriptRaw: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

export function TranscriptsModal({ isOpen, onClose }: Props) {
  const [rooms, setRooms] = useState<TranscriptRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<TranscriptRoom | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/call/my-transcripts')
      .then(r => r.json())
      .then(data => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className={styles.overlay} onClick={() => { setSelected(null); onClose() }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Конспекты звонков</h2>
          <button className={styles.closeBtn} onClick={() => { setSelected(null); onClose() }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {selected ? (
          <div className={styles.detail}>
            <button className={styles.backBtn} onClick={() => setSelected(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Назад
            </button>
            <div className={styles.detailMeta}>
              <span className={styles.detailName}>{selected.name}</span>
              {selected.topic && <span className={styles.detailTopic}>{selected.topic}</span>}
              <span className={styles.detailDate}>{fmt(selected.createdAt)}</span>
            </div>
            <pre className={styles.transcript}>{selected.transcriptRaw}</pre>
          </div>
        ) : (
          <div className={styles.list}>
            {loading && (
              <div className={styles.empty}>Загрузка...</div>
            )}
            {!loading && rooms.length === 0 && (
              <div className={styles.empty}>Конспектов пока нет</div>
            )}
            {!loading && rooms.map(room => (
              <button
                key={room.id}
                className={styles.row}
                onClick={() => setSelected(room)}
              >
                <span className={styles.rowIcon}><FileIcon /></span>
                <span className={styles.rowContent}>
                  <span className={styles.rowName}>{room.name}</span>
                  {room.topic && <span className={styles.rowTopic}>{room.topic}</span>}
                  <span className={styles.rowDate}>{fmt(room.createdAt)}</span>
                </span>
                <svg className={styles.rowArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
