import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {ChooseOptionPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useState} from 'react'
import styles from './ChooseOptionStudent.module.scss'

export function ChooseOptionStudent({
  payload,
  onChange
}: {
  payload: ChooseOptionPayload
  onChange: (a: StudentAnswer) => void
}) {
  const isMulti = Array.isArray(payload.correctId)
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) => {
    const next = isMulti ? (selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]) : [id]
    setSelected(next)
    onChange({
      type: TaskBlockType.CHOOSE_OPTION,
      value: isMulti ? next : next[0] ?? ''
    })
  }

  return (
    <div className={styles.block}>
      <p className={styles.question}>{payload.question}</p>
      <div className={styles.options}>
        {payload.options.map((opt) => (
          <button
            key={opt.id}
            type='button'
            className={`${styles.option} ${selected.includes(opt.id) ? styles.selected : ''}`}
            onClick={() => toggle(opt.id)}
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  )
}
