import { IconCopy } from '../icons'
import { NoteEntry } from '../types'
import styles from '../VideoCallPage.module.scss'

interface SummaryModalProps {
  finalTranscript: string | null
  callNotes: NoteEntry[]
  onClose: () => void
  onLeave: () => void
}

export function SummaryModal({ finalTranscript, callNotes, onClose, onLeave }: SummaryModalProps) {
  const text = finalTranscript ?? callNotes.map(n => `${n.identity} — ${n.text}`).join('\n')
  return (
    <div className={styles.summaryOverlay}>
      <div className={styles.summaryModal}>
        <div className={styles.summaryHeader}>
          <h2 className={styles.summaryTitle}>Конспект звонка</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <pre className={styles.summaryBody}>{text || 'Нет записей'}</pre>
        <div className={styles.summaryActions}>
          {text && (
            <button className={styles.pill} onClick={() => navigator.clipboard.writeText(text)}>
              <IconCopy /> Копировать
            </button>
          )}
          <button className={styles.summaryLeaveBtn} onClick={onLeave}>
            Выйти из звонка
          </button>
        </div>
      </div>
    </div>
  )
}
