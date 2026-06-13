'use client'

import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {TestResult, BlockResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {SavedTest} from '@/widgets/Tasks/Storage/testStorage'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import styles from './ResultScreen.module.scss'

interface Props {
  test: SavedTest
  result: TestResult
}

export function ResultScreen({test, result}: Props) {
  const t = useTranslations('TestPlayer')
  const tMap = useTranslations('roadMap')

  function grade(percent: number): {label: string; color: string} {
    if (percent >= 90) return {label: t('excellent'), color: '#1D9E75'}
    if (percent >= 70) return {label: t('good'), color: '#378ADD'}
    if (percent >= 50) return {label: t('satisfactory'), color: '#EF9F27'}
    return {label: t('needsWork'), color: '#E24B4A'}
  }

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

  const {label, color} = grade(result.percent)

  return (
    <div className={styles.page}>
      <div className={styles.score_card}>
        <div className={styles.circle} style={{borderColor: color}}>
          <span className={styles.percent} style={{color}}>
            {result.percent}%
          </span>
          <span className={styles.grade} style={{color}}>
            {label}
          </span>
        </div>

        <div className={styles.score_details}>
          <h1 className={styles.test_title}>{test.title}</h1>
          <p className={styles.score_text}>
            {t('correctAnswers', {score: result.totalScore, max: result.maxScore})}
          </p>
          <p className={styles.date}>
            {t('completedAt', {date: new Date(result.completedAt).toLocaleString()})}
          </p>
        </div>
      </div>

      <div className={styles.progress_wrap}>
        <div className={styles.progress_bar}>
          <div className={styles.progress_fill} style={{width: `${result.percent}%`, background: color}} />
        </div>
      </div>

      <div className={styles.breakdown}>
        <h2 className={styles.breakdown_title}>{t('breakdown')}</h2>
        {result.blocks.map((br, i) => (
          <BlockResultRow key={br.blockId} index={i + 1} result={br} label={blockLabel(br.blockType)} correct={t('correct')} wrong={t('wrong')} />
        ))}
      </div>

      <div className={styles.actions}>
        <button type='button' className={styles.retry_btn} onClick={() => window.location.reload()}>
          {t('retryBtn')}
        </button>
        <Link href='/' className={styles.home_btn}>
          {t('homeBtn')}
        </Link>
      </div>
    </div>
  )
}

function BlockResultRow({index, result, label, correct, wrong}: {index: number; result: BlockResult; label: string; correct: string; wrong: string}) {
  return (
    <div className={`${styles.block_row} ${result.isCorrect ? styles.correct : styles.wrong}`}>
      <span className={styles.block_num}>{index}</span>
      <span className={styles.block_type}>{label}</span>
      <span className={`${styles.block_badge} ${result.isCorrect ? styles.badge_ok : styles.badge_err}`}>
        {result.isCorrect ? correct : wrong}
      </span>
      <span className={styles.block_score}>
        {result.score} / {result.maxScore}
      </span>
    </div>
  )
}
