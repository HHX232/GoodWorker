import styles from '../VideoCallPage.module.scss'

interface ScreenSharePanelProps {
  sharingIdentity: string | null
  userName: string
  onStop: () => void
}

export function ScreenSharePanel({ sharingIdentity, userName, onStop }: ScreenSharePanelProps) {
  if (!sharingIdentity) return null
  const isLocal = sharingIdentity === userName
  return (
    <div className={styles.screenSharePanel}>
      <div className={styles.screenShareHeader}>
        <span>
          {isLocal ? 'Вы демонстрируете экран' : `${sharingIdentity} демонстрирует экран`}
        </span>
        {isLocal && (
          <button className={styles.screenShareStopBtn} onClick={onStop}>Остановить</button>
        )}
      </div>
      <video
        id={`ss-${sharingIdentity}`}
        className={styles.screenShareVideo}
        autoPlay
        playsInline
        muted={isLocal}
      />
    </div>
  )
}
