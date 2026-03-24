
'use client'
import { useDroppable } from '@dnd-kit/core'
import styles from './DropTaskZone.module.scss'

export const DropTaskZone = () => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'droppable-canvas',
  })

  return (
    <div
      ref={setNodeRef}
      className={`${styles.drop_zone} ${isOver ? styles.over : ''}`}
    >
      <span className={styles.drop_text}>Перенесите сюда нужный тест</span>
    </div>
  )
}