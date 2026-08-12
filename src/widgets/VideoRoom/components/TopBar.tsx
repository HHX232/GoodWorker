import { useState } from 'react'
import { IconCrown, IconMicOn } from '../icons'
import styles from '../VideoCallPage.module.scss'

interface TopBarProps {
  roomName: string
  topic?: string
  status?: string
  userName: string
  isOwner: boolean
  isMainSpeaker: boolean
}

export function TopBar({ roomName, topic, status, userName, isOwner, isMainSpeaker }: TopBarProps) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <span className={styles.topDot} />
        <span className={styles.topRoom}>{roomName}</span>
        {topic && <span className={styles.topTopic}>{topic}</span>}
        {status && !status.startsWith('Ошибка') && <span className={styles.topStatus}>{status}</span>}
      </div>
      <div className={styles.topBarRight}>
        <span className={styles.topUser}>{userName}</span>
        {isOwner && <span className={styles.topOwner}><IconCrown /> Владелец</span>}
        {!isOwner && isMainSpeaker && <span className={styles.topSpeaker}><IconMicOn /> Главный</span>}
      </div>
    </div>
  )
}

// ── Dev panel (development only) ──────────────────────────────────────────────

interface DevPanelProps {
  debugChunks: number
  debugMsgs: string[]
  agentIdentity?: string | null
  browserHasSpeech: boolean
  srError: string | null
  debugLog: string[]
}

export function DevPanel({ debugChunks, debugMsgs, agentIdentity, browserHasSpeech, srError, debugLog }: DevPanelProps) {
  const [showLogs, setShowLogs] = useState(false)
  return (
    <>
      <button className={styles.mobileLogBtn} onClick={() => setShowLogs(v => !v)}>
        {showLogs ? '✕' : '🪲'} {debugChunks > 0 ? `${debugChunks}✓` : 'лог'}
      </button>
      {showLogs && (
        <div className={styles.mobileLogPanel}>
          <div className={styles.mobileLogHeader}>
            <span>agent: {agentIdentity ?? '—'}</span>
            <span>chunks: {debugChunks}</span>
            <span>SR: {browserHasSpeech ? 'yes' : 'no'}</span>
            {srError && <span style={{ color: '#f87171' }}>{srError}</span>}
          </div>
          <div className={styles.mobileLogDivider}>── data-channel ──</div>
          {debugMsgs.length === 0
            ? <div className={styles.mobileLogEmpty}>нет сообщений</div>
            : debugMsgs.map((m, i) => <div key={i} className={styles.mobileLogLine}>{m}</div>)
          }
          <div className={styles.mobileLogDivider}>── room events ──</div>
          {debugLog.length === 0
            ? <div className={styles.mobileLogEmpty}>нет событий</div>
            : debugLog.map((m, i) => (
              <div key={i} className={`${styles.mobileLogLine} ${m.toLowerCase().includes('error') ? styles.mobileLogErr : ''}`}>{m}</div>
            ))
          }
        </div>
      )}
    </>
  )
}
