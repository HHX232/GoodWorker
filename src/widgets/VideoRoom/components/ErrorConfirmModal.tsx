import styles from '../VideoCallPage.module.scss'

export interface AnalyzedError {
  id: string
  description: string | null
  fragment: string | null
  isCorrection: boolean
  student: { name: string }
  categories: { category: { translations: { name: string }[] } }[]
}

interface ErrorConfirmModalProps {
  analyzedErrors: AnalyzedError[]
  removedErrorIds: Set<string>
  errorEditMode: boolean
  expandedErrorId: string | null
  onToggleRemove: (id: string) => void
  onSetEditMode: (v: boolean) => void
  onSetExpanded: (id: string | null) => void
  onConfirm: () => void
}

export function ErrorConfirmModal({
  analyzedErrors,
  removedErrorIds,
  errorEditMode,
  expandedErrorId,
  onToggleRemove,
  onSetEditMode,
  onSetExpanded,
  onConfirm,
}: ErrorConfirmModalProps) {
  const visible = analyzedErrors.filter(e => !removedErrorIds.has(e.id))
  const errors = visible.filter(e => !e.isCorrection)
  const corrections = visible.filter(e => e.isCorrection)

  return (
    <div className={styles.summaryOverlay}>
      <div className={styles.errorConfirmModal}>
        <h2 className={styles.summaryTitle}>Итоги занятия</h2>
        <p className={styles.errorConfirmDesc}>Система обнаружила на этом занятии:</p>

        <div className={styles.errorConfirmCounts}>
          <div className={styles.errorConfirmCount}>
            <span className={styles.errorConfirmCountNum} style={{ color: '#DC2626' }}>{errors.length}</span>
            <span className={styles.errorConfirmCountLabel}>ошибок</span>
          </div>
          <div className={styles.errorConfirmCount}>
            <span className={styles.errorConfirmCountNum} style={{ color: '#22c55e' }}>{corrections.length}</span>
            <span className={styles.errorConfirmCountLabel}>исправлений</span>
          </div>
        </div>

        {!errorEditMode ? (
          <>
            <div className={styles.errorPreviewList}>
              {visible.slice(0, 5).map(e => (
                <div key={e.id} className={`${styles.errorPreviewItem} ${e.isCorrection ? styles.errorPreviewCorrection : styles.errorPreviewError}`}>
                  <span className={styles.errorPreviewBadge}>{e.isCorrection ? '✓' : '!'}</span>
                  <span className={styles.errorPreviewText}>{e.description}</span>
                </div>
              ))}
              {visible.length > 5 && <p className={styles.errorPreviewMore}>+ ещё {visible.length - 5}</p>}
            </div>
            <div className={styles.summaryActions}>
              <button className={styles.pill} onClick={() => onSetEditMode(true)}>Редактировать</button>
              <button className={styles.summaryLeaveBtn} onClick={onConfirm}>Согласен — завершить</button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.errorEditList}>
              {visible.length === 0 && <p className={styles.notesEmpty}>Все записи удалены</p>}
              {visible.map(e => (
                <div key={e.id} className={`${styles.errorEditItem} ${e.isCorrection ? styles.errorEditCorrection : styles.errorEditError}`}>
                  <div className={styles.errorEditTop}>
                    <span className={`${styles.errorTypeBadge} ${e.isCorrection ? styles.errorTypeBadgeOk : styles.errorTypeBadgeBad}`}>
                      {e.isCorrection ? 'Исправлено' : 'Ошибка'}
                    </span>
                    <span className={styles.errorWho}>{e.student.name}</span>
                    <div style={{ flex: 1 }} />
                    {e.fragment && (
                      <button
                        className={styles.errorExpandBtn}
                        onClick={() => onSetExpanded(expandedErrorId === e.id ? null : e.id)}
                        title="Показать фрагмент конспекта"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points={expandedErrorId === e.id ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                        </svg>
                      </button>
                    )}
                    <button
                      className={styles.errorRemoveBtn}
                      onClick={() => onToggleRemove(e.id)}
                      title="Убрать"
                    >×</button>
                  </div>
                  <p className={styles.errorEditDesc}>{e.description}</p>
                  {expandedErrorId === e.id && e.fragment && (
                    <div className={styles.errorFragment}>
                      <span className={styles.errorFragmentLabel}>Фрагмент конспекта:</span>
                      <p className={styles.errorFragmentText}>«{e.fragment}»</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.summaryActions}>
              <button className={styles.pill} onClick={() => onSetEditMode(false)}>← Назад</button>
              <button className={styles.summaryLeaveBtn} onClick={onConfirm}>Подтвердить и завершить</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
