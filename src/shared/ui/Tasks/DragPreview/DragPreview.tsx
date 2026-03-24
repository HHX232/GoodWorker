import { TaskBlockRegistry } from '@/features'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import styles from './DragPreview.module.scss'

interface Props {
  taskType: TaskBlockType
}

export const DragTaskPreview = ({ taskType }: Props) => {
  const task = TaskBlockRegistry[taskType]

  return (
    <div className={styles.preview}>
      <div className={styles.icon}>{task.icon}</div>
      <span className={styles.label}>{task.label}</span>
    </div>
  )
}