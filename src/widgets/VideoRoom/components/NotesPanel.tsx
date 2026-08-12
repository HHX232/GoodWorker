import { NoteEntry } from '../types'
import styles from '../VideoCallPage.module.scss'

interface NotesPanelProps {
  callNotes: NoteEntry[]
  srError: string | null
  browserHasSpeech: boolean
  locallyMutedIds: Set<string>
  onClose: () => void
}

export function NotesPanel({ callNotes, srError, browserHasSpeech, locallyMutedIds, onClose }: NotesPanelProps) {
  const visibleNotes = callNotes.filter(n => !locallyMutedIds.has(n.identity))
  return (
    <div className={styles.notesPanel} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.notesPanelInner}>
        <div className={styles.notesPanelHeader}>
          <span>Конспект урока</span>
          {!browserHasSpeech && callNotes.length === 0 && (
            <span className={styles.notesSrWarning}>Chrome</span>
          )}
          <button className={styles.notesPanelClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.notesList}>
          {srError && <p className={styles.notesSrError}>{srError}</p>}
          {visibleNotes.length === 0 ? (
            <p className={styles.notesEmpty}>
              {!browserHasSpeech
                ? 'Используйте Chrome для транскрипции.'
                : srError
                ? 'Транскрипция недоступна — нужен агент.'
                : 'Говорите — текст появится здесь...'}
            </p>
          ) : (
            visibleNotes.map((n, i) => (
              <div key={i} className={styles.noteEntry}>
                <span className={styles.noteAuthor}>{n.identity}</span>
                <span className={styles.noteText}>{n.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
