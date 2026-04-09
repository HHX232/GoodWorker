import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {HighlightTextPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useState} from 'react'
import styles from './HighlightTextStudent.module.scss'
export function HighlightTextStudent({
  payload,
  onChange
}: {
  payload: HighlightTextPayload
  onChange: (a: StudentAnswer) => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onChange({type: TaskBlockType.HIGHLIGHT_TEXT, value: [...next]})
      return next
    })
  }

  if (!payload.tokens) return null

  return (
    <div className={styles.block}>
      {payload.instruction && <p className={styles.instruction}>{payload.instruction}</p>}
      <div className={styles.tokens}>
        {payload.tokens.map((token) => {
          const isPunct = /^[^\wА-Яа-яЁёA-Za-z]$/.test(token.text)
          if (isPunct)
            return (
              <span key={token.id} className={styles.punct}>
                {token.text}
              </span>
            )
          return (
            <button
              key={token.id}
              type='button'
              className={`${styles.token} ${selected.has(token.id) ? styles.token_selected : ''}`}
              onClick={() => toggle(token.id)}
            >
              {token.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
