'use client'

import {TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {SavedTest} from '@/widgets/Tasks/Storage/testStorage'
import {PieChart} from '@mui/x-charts/PieChart'
import {useTranslations} from 'next-intl'
import styles from './ResultToast.module.scss'

function grade(percent: number): {color: string} {
  if (percent >= 90) return {color: '#1D9E75'}
  if (percent >= 70) return {color: '#378ADD'}
  if (percent >= 50) return {color: '#EF9F27'}
  return {color: '#E24B4A'}
}

interface Props {
  test: SavedTest
  result: TestResult
  onRetry: () => void
  onClose: () => void
}

export function ResultToast({test: _test, result, onRetry, onClose}: Props) {
  const t = useTranslations('TestPlayer')
  const tMap = useTranslations('roadMap')

  const blockLabel = (type: TaskBlockType): string => {
    const map: Partial<Record<TaskBlockType, string>> = {
      [TaskBlockType.CHOOSE_OPTION]: tMap('chooseOption'),
      [TaskBlockType.SEQUENCE]: tMap('sequence'),
      [TaskBlockType.MATCH_PAIRS]: tMap('matchPairs'),
      [TaskBlockType.FREE_ANSWER]: tMap('freeAnswer'),
      [TaskBlockType.HIGHLIGHT_TEXT]: tMap('highlightText'),
      [TaskBlockType.WORD_SCRAMBLE]: tMap('wordScramble'),
      [TaskBlockType.DIALOGUE]: tMap('dialogue'),
      [TaskBlockType.FILL_TEXT]: tMap('fillText'),
    }
    return map[type] ?? type
  }

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
              {id: 'correct', value: correct, label: t('correct')},
              {id: 'wrong', value: wrong, label: t('wrong')},
            ],
          },
          {
            id: 'types',
            innerRadius: 70,
            outerRadius: 90,
            data: [
              {id: 'correct', value: correct, label: t('correct')},
              {id: 'wrong', value: wrong, label: t('wrong')},
            ],
          },
        ]}
        slotProps={{
          tooltip: {sx: {zIndex: 9999999}, trigger: 'none'},
        }}
        sx={{
          '& .MuiPieArc-root': {transition: 'all 0.5s ease-out'},
          '& .MuiPieArcLabel-root': {fill: '#fff', fontSize: 18, fontWeight: 600},
          zIndex: 9999999,
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
            <span className={styles.type}>{blockLabel(br.blockType)}</span>
            <span className={`${styles.badge} ${br.isCorrect ? styles.badge_ok : styles.badge_err}`}>
              {br.isCorrect ? t('correct') : t('wrong')}
            </span>
            <span className={styles.pts}>
              {br.score}/{br.maxScore}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button type='button' className={styles.btn_retry} onClick={onRetry}>
          {t('retryBtn')}
        </button>
        <button type='button' className={styles.btn_close} onClick={onClose}>
          {t('closeBtn')}
        </button>
      </div>
    </div>
  )
}
