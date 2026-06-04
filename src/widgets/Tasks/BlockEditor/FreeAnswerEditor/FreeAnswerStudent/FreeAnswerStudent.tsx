'use client'
import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {FreeAnswerPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import styles from './FreeAnswerStudent.module.scss'
export function FreeAnswerStudent({
  payload,
  onChange
}: {
  payload: FreeAnswerPayload
  onChange: (a: StudentAnswer) => void
}) {
  const t = useTranslations('TaskEditors')
  const [value, setValue] = useState('')

  return (
    <div className={styles.block}>
      <p className={styles.question}>{payload.question}</p>
      <textarea
        className={styles.textarea}
        rows={4}
        placeholder={t('answerPlaceholder')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onChange({type: TaskBlockType.FREE_ANSWER, value: e.target.value})
        }}
      />
    </div>
  )
}
