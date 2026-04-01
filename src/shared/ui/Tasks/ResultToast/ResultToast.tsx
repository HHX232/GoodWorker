import {TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {SavedTest} from '@/widgets/Tasks/Storage/testStorage'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import styles from './ResultToast.module.scss'

const BLOCK_LABELS: Partial<Record<TaskBlockType, string>> = {
  [TaskBlockType.CHOOSE_OPTION]: 'Выбор варианта',
  [TaskBlockType.SEQUENCE]: 'Последовательность',
  [TaskBlockType.MATCH_PAIRS]: 'Соединить пары',
  [TaskBlockType.FREE_ANSWER]: 'Свободный ответ',
  [TaskBlockType.HIGHLIGHT_TEXT]: 'Выделение текста',
  [TaskBlockType.WORD_SCRAMBLE]: 'Сборка слова',
  [TaskBlockType.DIALOGUE]: 'Диалог',
  [TaskBlockType.FILL_TEXT]: 'Заполнение пропусков'
}

function grade(percent: number): {label: string; color: string} {
  if (percent >= 90) return {label: 'Отлично', color: '#1D9E75'}
  if (percent >= 70) return {label: 'Хорошо', color: '#378ADD'}
  if (percent >= 50) return {label: 'Удовлетворительно', color: '#EF9F27'}
  return {label: 'Нужно повторить', color: '#E24B4A'}
}

interface Props {
  test: SavedTest
  result: TestResult
  onRetry: () => void
  onClose: () => void
}

export function ResultToast({test, result, onRetry, onClose}: Props) {
  const {label, color} = grade(result.percent)

  return (
    <div className={styles.toast}>
      {/* Шапка с кругом */}
      <div className={styles.top}>
        <div className={styles.ring} style={{borderColor: color}}>
          <span className={styles.pct} style={{color}}>
            {result.percent}%
          </span>
          <span className={styles.lbl} style={{color}}>
            {label}
          </span>
        </div>
        <div className={styles.meta}>
          <span className={styles.title}>{test.title}</span>
          <span className={styles.score}>
            Верных: {result.totalScore} из {result.maxScore}
          </span>
          <span className={styles.date}>{new Date(result.completedAt).toLocaleString('ru-RU')}</span>
        </div>
      </div>

      {/* Прогресс */}
      <div className={styles.progress}>
        <div className={styles.fill} style={{width: `${result.percent}%`, background: color}} />
      </div>

      {/* Разбор */}
      <div className={styles.rows}>
        {result.blocks.map((br, i) => (
          <div key={br.blockId} className={`${styles.row} ${br.isCorrect ? styles.ok : styles.err}`}>
            <span className={styles.num}>{i + 1}</span>
            <span className={styles.type}>{BLOCK_LABELS[br.blockType] ?? br.blockType}</span>
            <span className={`${styles.badge} ${br.isCorrect ? styles.badge_ok : styles.badge_err}`}>
              {br.isCorrect ? '✓ Верно' : '✗ Неверно'}
            </span>
            <span className={styles.pts}>
              {br.score}/{br.maxScore}
            </span>
          </div>
        ))}
      </div>

      {/* Кнопки */}
      <div className={styles.actions}>
        <button type='button' className={styles.btn_retry} onClick={onRetry}>
          Пройти снова
        </button>
        <button type='button' className={styles.btn_close} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
