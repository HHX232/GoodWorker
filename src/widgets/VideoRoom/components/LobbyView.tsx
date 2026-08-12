import { IconVideo } from '../icons'
import styles from '../VideoCallPage.module.scss'

interface LobbyViewProps {
  limitBlocked: boolean
  autoJoinRoom?: string
  userName: string
  status?: string
  onBack: () => void
  onRetry: () => void
}

export function LobbyView({ limitBlocked, autoJoinRoom, userName, status, onBack, onRetry }: LobbyViewProps) {
  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyCard}>
        {limitBlocked ? (
          <>
            <div className={styles.limitBlockedIcon}>🔒</div>
            <h1 className={styles.limitBlockedTitle}>Комната заполнена</h1>
            <p className={styles.limitBlockedDesc}>
              В бесплатных комнатах не более 3 участников одновременно.
              <br />Владелец комнаты может подключить VIP для увеличения лимита.
            </p>
            <button className={styles.lobbyBackBtn} onClick={onBack}>← Назад</button>
          </>
        ) : (
          <>
            <div className={styles.lobbyIcon}><IconVideo /></div>
            <h1 className={styles.lobbyTitle}>Видео-звонок</h1>
            <p className={styles.lobbySubtitle}>
              {autoJoinRoom ? `Подключаемся к «${autoJoinRoom}»...` : 'Введите название комнаты'}
            </p>
            <div className={styles.lobbyUser}><span className={styles.lobbyDot} />{userName}</div>
            {status && <p className={styles.lobbyStatus}>{status}</p>}
            {status?.startsWith('Ошибка') && (
              <button className={styles.lobbyRetryBtn} onClick={onRetry}>Повторить</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
