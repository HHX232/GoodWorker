import {TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {SavedTest} from '@/widgets/Tasks/Storage/testStorage'
import {PieChart} from '@mui/x-charts/PieChart'
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
  const {color} = grade(result.percent)
  const correct = result.totalScore
  const wrong = result.maxScore - result.totalScore

  return (
    <div className={styles.toast}>
      <PieChart
        series={[
          {
            id: 'result',
            arcLabel: (item) => `${item.value}`,
            innerRadius: 0,

            outerRadius: 60,
            data: [
              {id: 'correct', value: correct, label: 'Верно'},
              {id: 'wrong', value: wrong, label: 'Неверно'}
            ]
          },
          {
            id: 'types',
            innerRadius: 70,
            outerRadius: 90,
            data: [
              {id: 'correct', value: correct, label: 'Верно'},
              {id: 'wrong', value: wrong, label: 'Неверно'}
            ]
          }
        ]}
        slotProps={{
          tooltip: {
            sx: {
              zIndex: 9999999
            },
            trigger: 'none'
          }
        }}
        sx={{
          '& .MuiPieArc-root': {
            transition: 'all 0.5s ease-out'
          },
          '& .MuiPieArcLabel-root': {
            fill: '#fff',
            fontSize: 18,
            fontWeight: 600
          },
          zIndex: 9999999
        }}
        width={200}
        height={200}
        hideLegend
      />

      <div className={styles.progress}>
        <div className={styles.fill} style={{width: `${result.percent}%`, background: color}} />
      </div>

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
