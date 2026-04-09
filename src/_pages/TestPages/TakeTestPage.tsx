'use client'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'

import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useParams} from 'next/navigation'
import {useEffect, useState} from 'react'

import {calculateResult, StudentAnswer, TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {ResultToast} from '@/shared/ui/Tasks/ResultToast/ResultToast'
import {NavBar} from '@/widgets/BaseUI'
import {SavedTest, testStorage} from '@/widgets/Tasks/Storage/testStorage'
import {toast} from 'sonner'
import styles from './TakeTestPage.module.scss'
import {TestPlayer} from './TestPlayer/TestPlayer'

const BLOCK_LABELS: Partial<Record<TaskBlockType, string>> = {
  [TaskBlockType.CHOOSE_OPTION]: 'Выберите вариант ответа',
  [TaskBlockType.FREE_ANSWER]: 'Напишите ответ',
  [TaskBlockType.SEQUENCE]: 'Расставьте в правильном порядке',
  [TaskBlockType.MATCH_PAIRS]: 'Сопоставьте пары',
  [TaskBlockType.HIGHLIGHT_TEXT]: 'Выделите правильные слова',
  [TaskBlockType.WORD_SCRAMBLE]: 'Составьте слово / предложение',
  [TaskBlockType.DIALOGUE]: 'Расставьте диалог в верном порядке',
  [TaskBlockType.FILL_TEXT]: 'Заполните пропуски'
}

export function BlockWrapper({block, children}: {block: TestBlock; children: React.ReactNode}) {
  const label = BLOCK_LABELS[block.type as TaskBlockType]
  if (!label) return <>{children}</>

  return (
    <div className={styles.block_card}>
      <span className={styles.block_label}>{label}</span>
      {children}
    </div>
  )
}

export default function TakeTestPage() {
  const params = useParams()
  const testId = params?.testId as string

  const [test, setTest] = useState<SavedTest | null>(null)
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map())
  const [result, setResult] = useState<TestResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    const found = testStorage.getById(testId)
    found ? setTest(found) : setNotFound(true)
  }, [testId])

  const setAnswer = (blockId: string, answer: StudentAnswer) => setAnswers((prev) => new Map(prev).set(blockId, answer))

  const handleSubmit = () => {
    if (!test) return
    setIsSubmitted(true)
    const res = calculateResult(test.blocks, answers)
    setResult(res)

    toast.custom(
      (id) => (
        <ResultToast
          test={test}
          result={res}
          onRetry={() => {
            toast.dismiss(id)
            window.location.reload()
          }}
          onClose={() => toast.dismiss(id)}
        />
      ),
      {
        duration: Infinity,
        id: 'test-result'
      }
    )
  }
  const handleResult = (res: TestResult) => {
    toast.custom(
      (id) => (
        <ResultToast
          test={test!}
          result={res}
          onRetry={() => {
            toast.dismiss(id)
            window.location.reload()
          }}
          onClose={() => toast.dismiss(id)}
        />
      ),
      {duration: Infinity, id: 'test-result'}
    )
  }

  if (notFound) return <div className={styles.error}>Тест не найден</div>
  if (!test) return <div className={styles.loading}>Загрузка...</div>

  return (
    <div className={`container default_content ${styles.content}`}>
      <NavBar />
      <div className={styles.main_content}>
        <h1>{test.title}</h1>
        <TestPlayer showInlineResult={false} blocks={test.blocks} onResult={handleResult} />
      </div>
    </div>
  )
}
