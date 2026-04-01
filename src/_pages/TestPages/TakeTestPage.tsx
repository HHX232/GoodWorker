/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'

import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useParams} from 'next/navigation'
import {useEffect, useState} from 'react'

import {calculateResult, StudentAnswer, TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {
  ChooseOptionPayload,
  DialoguePayload,
  FreeAnswerPayload,
  MatchPairsPayload,
  SequencePayload,
  WordScramblePayload
} from '@/shared/types/Tasks/TaskPayload.type'
import {ResultToast} from '@/shared/ui/Tasks/ResultToast/ResultToast'
import {DialogueStudentView} from '@/widgets/Tasks/BlockEditor/DialogueEditor/DialogueEditor'
import {FillTextEditor} from '@/widgets/Tasks/BlockEditor/FillTextEditor/FillTextEditor'
import {HighlightStudentView} from '@/widgets/Tasks/BlockEditor/HighlightTextEditor/HighlightTextEditor'
import {InfoAudioEditor} from '@/widgets/Tasks/BlockEditor/Info/InfoAudioEditor/InfoAudioEditor'
import {InfoMediaEditor} from '@/widgets/Tasks/BlockEditor/Info/InfoMediaEditor/InfoMediaEditor'
import {InfoTextEditor} from '@/widgets/Tasks/BlockEditor/Info/InfoTextEditor/InfoTextEditor'
import {getShuffledItems, StudentView} from '@/widgets/Tasks/BlockEditor/WordScrambleEditor/WordScrambleEditor'
import {SavedTest, testStorage} from '@/widgets/Tasks/Storage/testStorage'
import {toast} from 'sonner'
import {ChooseOptionStudent, FreeAnswerStudent, MatchPairsStudent, SequenceStudent} from './Studentviews/Studentviews'
import styles from './TakeTestPage.module.scss'
import {NavBar} from '@/widgets/BaseUI'

// ── Роутер блоков ─────────────────────────────────────────────────────────────

function BlockView({
  block,
  onChange,
  isSubmitted
}: {
  block: TestBlock
  onChange: (blockId: string, answer: StudentAnswer) => void
  isSubmitted: boolean
}) {
  const cb = (a: StudentAnswer) => onChange(block.id, a)
  const p = block.payload as any

  switch (block.type) {
    case TaskBlockType.CHOOSE_OPTION:
      return <ChooseOptionStudent payload={p as ChooseOptionPayload} onChange={cb} />

    case TaskBlockType.FREE_ANSWER:
      return <FreeAnswerStudent payload={p as FreeAnswerPayload} onChange={cb} />

    case TaskBlockType.SEQUENCE:
      return <SequenceStudent payload={p as SequencePayload} onChange={cb} />

    case TaskBlockType.MATCH_PAIRS:
      return <MatchPairsStudent payload={p as MatchPairsPayload} onChange={cb} />

    case TaskBlockType.HIGHLIGHT_TEXT:
      return (
        <HighlightStudentView
          instruction={p.instruction}
          tokens={p.tokens ?? []}
          onChange={(selected) => cb({type: TaskBlockType.HIGHLIGHT_TEXT, value: selected})}
          externalChecked={isSubmitted}
        />
      )

    case TaskBlockType.WORD_SCRAMBLE: {
      const wp = p as WordScramblePayload
      if (!wp.source) return null
      return (
        <StudentView
          source={wp.source}
          mode={wp.mode}
          hint={wp.hint}
          shuffledItems={getShuffledItems(wp.source, wp.mode)}
          onChange={cb}
          externalChecked={isSubmitted}
        />
      )
    }

    case TaskBlockType.DIALOGUE:
      return (
        <DialogueStudentView
          payload={p as DialoguePayload}
          onChange={(ids) => cb({type: TaskBlockType.DIALOGUE, value: ids})}
          externalChecked={isSubmitted}
        />
      )

    // INFO-блоки — только показываем, не собираем ответ
    case TaskBlockType.INFO_TEXT:
    case TaskBlockType.INFO_MEDIA:
    case TaskBlockType.INFO_AUDIO:
      return <InfoBlockView block={block} />

    case TaskBlockType.FILL_TEXT:
      return <FillTextEditor blockId='123' onlyPass onChangeAnswer={cb} payload={p} />

    default:
      return null
  }
}

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

function InfoBlockView({block}: {block: TestBlock}) {
  const p = block.payload as any

  switch (block.type) {
    case TaskBlockType.INFO_TEXT:
      return <InfoTextEditor blockId={block.id} payload={p} viewOnly />

    case TaskBlockType.INFO_MEDIA:
      return <InfoMediaEditor blockId={block.id} payload={p} viewOnly />

    case TaskBlockType.INFO_AUDIO:
      return <InfoAudioEditor blockId={block.id} payload={p} viewOnly />

    default:
      return null
  }
}
// ── Главная страница ──────────────────────────────────────────────────────────

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

  if (notFound) return <div className={styles.error}>Тест не найден</div>
  if (!test) return <div className={styles.loading}>Загрузка...</div>

  return (
    <div className={`container default_content ${styles.content}`}>
      <NavBar />
      <div className={styles.main_content}>
        <div className={`${styles.page} `}>
          <div className={styles.header}>
            <h1 className={styles.title}>{test.title}</h1>
            {test.theme && <p className={styles.theme}>{test.theme}</p>}
            {test.description && <p className={styles.desc}>{test.description}</p>}
          </div>

          <div className={styles.blocks}>
            {test.blocks.map((block: any) => (
              <div key={block.id} className={styles.block}>
                <BlockWrapper block={block}>
                  <BlockView block={block} onChange={setAnswer} isSubmitted={isSubmitted} />
                </BlockWrapper>
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <button type='button' className={styles.submit_btn} onClick={handleSubmit}>
              Завершить тест
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
