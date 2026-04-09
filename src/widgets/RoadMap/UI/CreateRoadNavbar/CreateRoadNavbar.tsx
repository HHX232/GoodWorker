'use client'
import RoadMapBlockRegistry from '@/features/Roadmap/registry'
import {RoadMapBlockType} from '@/shared/types/RoadMap/RoadMap.types'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import styles from './CreateRoadNavbar.module.scss'

function CreateRoadNavbar() {
  return (
    <div className={styles.main}>
      <TaskMenuBtn taskType={RoadMapBlockType.TEST_LINK} id='taskmenu-task-example'></TaskMenuBtn>
      <TaskMenuBtn taskType={RoadMapBlockType.INFO_TEXT} id='taskmenu-task-example'></TaskMenuBtn>
      <TaskMenuBtn taskType={RoadMapBlockType.DIVIDER} id='taskmenu-task-example'></TaskMenuBtn>
      <TaskMenuBtn taskType={RoadMapBlockType.INFO_AUDIO} id='taskmenu-task-example'></TaskMenuBtn>
      <TaskMenuBtn taskType={RoadMapBlockType.INFO_MEDIA} id='taskmenu-task-example'></TaskMenuBtn>
      <TaskMenuBtn taskType={RoadMapBlockType.POST_LINK} id='taskmenu-task-example'></TaskMenuBtn>
      <TaskMenuBtn taskType={RoadMapBlockType.DOWNLOAD_FILE_LINK} id='taskmenu-task-example'></TaskMenuBtn>
      <TaskMenuBtn taskType={RoadMapBlockType.ACTIVE_TEST} id='taskmenu-task-example'></TaskMenuBtn>
    </div>
  )
}

export default CreateRoadNavbar

function TaskMenuBtn({taskType, id}: {taskType: RoadMapBlockType; id?: string}) {
  const t = useTranslations('roadMap')
  const task = RoadMapBlockRegistry[taskType]
  const [isDragging, setIsDragging] = useState(false)

  if (!task) return null

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData('application/reactflow', taskType)
    event.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  const onDragEnd = () => setIsDragging(false)

  return (
    <button
      id={id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid var(--color-border-secondary)',
        background: 'var(--color-background-secondary)',
        color: 'var(--color-text-primary)',
        fontSize: 14,
        whiteSpace: 'nowrap'
      }}
    >
      <task.icon style={{minHeight: '16px', minWidth: '16px'}} width={16} height={16} />
      {t(task.label)}
    </button>
  )
}
