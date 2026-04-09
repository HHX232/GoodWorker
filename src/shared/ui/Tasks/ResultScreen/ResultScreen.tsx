'use client'

import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import Link from 'next/link'
import styles from './ResultScreen.module.scss'
import {TestResult, BlockResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {SavedTest} from '@/widgets/Tasks/Storage/testStorage'

interface Props {
  test: SavedTest
  result: TestResult
}

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

export function ResultScreen({test, result}: Props) {
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
            Правильных ответов: <strong>{result.totalScore}</strong> из <strong>{result.maxScore}</strong>
          </p>
          <p className={styles.date}>Пройден: {new Date(result.completedAt).toLocaleString('ru-RU')}</p>
        </div>
      </div>

      <div className={styles.progress_wrap}>
        <div className={styles.progress_bar}>
          <div className={styles.progress_fill} style={{width: `${result.percent}%`, background: color}} />
        </div>
      </div>

      <div className={styles.breakdown}>
        <h2 className={styles.breakdown_title}>Разбор по заданиям</h2>
        {result.blocks.map((br, i) => (
          <BlockResultRow key={br.blockId} index={i + 1} result={br} />
        ))}
      </div>

      <div className={styles.actions}>
        <button type='button' className={styles.retry_btn} onClick={() => window.location.reload()}>
          Пройти снова
        </button>
        <Link href='/' className={styles.home_btn}>
          На главную
        </Link>
      </div>
    </div>
  )
}

function BlockResultRow({index, result}: {index: number; result: BlockResult}) {
  const label = BLOCK_LABELS[result.blockType] ?? result.blockType
  return (
    <div className={`${styles.block_row} ${result.isCorrect ? styles.correct : styles.wrong}`}>
      <span className={styles.block_num}>{index}</span>
      <span className={styles.block_type}>{label}</span>
      <span className={`${styles.block_badge} ${result.isCorrect ? styles.badge_ok : styles.badge_err}`}>
        {result.isCorrect ? '✓ Верно' : '✗ Неверно'}
      </span>
      <span className={styles.block_score}>
        {result.score} / {result.maxScore}
      </span>
    </div>
  )
}
