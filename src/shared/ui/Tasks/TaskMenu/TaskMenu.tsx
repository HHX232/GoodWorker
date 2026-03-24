// widgets/test-constructor/ui/TaskMenu/TaskMenu.tsx
'use client'
import { TaskBlockRegistry } from '@/features'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { useDraggable } from '@dnd-kit/core'
import { CoinsIcon } from 'lucide-react'
import styles from './TaskMenu.module.scss'

export const TaskMenu = () => {
  return (
    <div className={styles.menu_box}>
      <h3 className={styles.task_title}>Перетащите блок</h3>
      <ul className={styles.task_list}>
        {Object.values(TaskBlockType).map((type) => (
          <li key={type}>
            <TaskMenuButton taskType={type} />
          </li>
        ))}
      </ul>
    </div>
  )
}

const TaskMenuButton = ({ taskType, id }: { taskType: TaskBlockType; id?: string }) => {
  const task = TaskBlockRegistry[taskType]

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${taskType}`,
    data: {
      type: taskType,
      origin: 'palette',
    },
  })

  return (
    <div id={id} className={styles.task_button_box}>
      <div
        ref={setNodeRef}
        className={`${styles.task_icon} ${isDragging ? styles.dragging : ''}`}
        {...listeners}
        {...attributes}
      >
        {task.icon}
      </div>
      <div className={styles.task_info}>
        <span className={styles.task_label}>{task.label}</span>
        {task.credits !== 0 && (
          <div className={styles.task_credits}>
            <CoinsIcon size={14} className={styles.coins} />
            <p>{task.credits}</p>
          </div>
        )}
      </div>
    </div>
  )
}