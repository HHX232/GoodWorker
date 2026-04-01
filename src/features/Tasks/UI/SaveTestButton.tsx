// SaveTestButton.tsx — теперь он же провайдер контекста
'use client'
import {useSaveTest} from '@/features/hooks/Test/useSaveTest'
import {InvalidTestBlocksContext} from '@/shared/ui/Tasks/providers/InvalidBlocksContext/InvalidBlocksContext'
import styles from './SaveTestButton.module.scss'

interface Props {
  existingId?: string
}

export function SaveTestButton({existingId}: Props) {
  const {save, status, invalidBlockIds} = useSaveTest(existingId)

  const label = {
    idle: 'Сохранить тест',
    saving: 'Сохраняем...',
    saved: '✓ Сохранено',
    error: 'Ошибка — повторить'
  }[status]

  return (
    <InvalidTestBlocksContext.Provider value={invalidBlockIds}>
      <button type='button' className={`${styles.btn} ${styles[status]}`} onClick={save} disabled={status === 'saving'}>
        {label}
      </button>
    </InvalidTestBlocksContext.Provider>
  )
}
