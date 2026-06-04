'use client'
import RoadMapBlockRegistry from '@/features/Roadmap/registry'
import {RoadMapBlockType} from '@/shared/types/RoadMap/RoadMap.types'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import styles from './CreateRoadNavbar.module.scss'

const allItems = [
  RoadMapBlockType.TEST_LINK,
  RoadMapBlockType.INFO_TEXT,
  RoadMapBlockType.DIVIDER,
  RoadMapBlockType.INFO_AUDIO,
  RoadMapBlockType.INFO_MEDIA,
  RoadMapBlockType.POST_LINK,
  RoadMapBlockType.DOWNLOAD_FILE_LINK,
  RoadMapBlockType.ACTIVE_TEST,
  RoadMapBlockType.ACTIVE_COMMENT
]

const BLOCK_BTN_IDS: Partial<Record<RoadMapBlockType, string>> = {
  [RoadMapBlockType.INFO_TEXT]:           'roadmap-btn-info-text',
  [RoadMapBlockType.INFO_MEDIA]:          'roadmap-btn-media',
  [RoadMapBlockType.INFO_AUDIO]:          'roadmap-btn-audio',
  [RoadMapBlockType.ACTIVE_TEST]:         'roadmap-btn-active-test',
  [RoadMapBlockType.TEST_LINK]:           'roadmap-btn-test-link',
  [RoadMapBlockType.POST_LINK]:           'roadmap-btn-posts',
  [RoadMapBlockType.DOWNLOAD_FILE_LINK]:  'roadmap-btn-files',
  [RoadMapBlockType.ACTIVE_COMMENT]:      'roadmap-btn-comment',
  [RoadMapBlockType.DIVIDER]:             'roadmap-btn-divider',
}

const TOP_COUNT = 4

function CreateRoadNavbar() {
  const t = useTranslations('roadMap')
  const [isExpanded, setIsExpanded] = useState(false)

  const topItems = allItems.slice(0, TOP_COUNT)
  const bottomItems = allItems.slice(TOP_COUNT)

  return (
    <div className={`${styles.main} ${isExpanded ? styles.expanded : ''}`} id="roadmap-navbar">
      {/* десктоп — все кнопки подряд */}
      <div className={styles.desktop_group}>
        {allItems.map((type) => (
          <TaskMenuBtn key={type} taskType={type} id={BLOCK_BTN_IDS[type]} />
        ))}
      </div>

      {/* мобайл — верхний ряд (всегда виден) */}
      <div className={styles.mobile_top}>
        {topItems.map((type) => (
          <TaskMenuBtn key={type} taskType={type} id={BLOCK_BTN_IDS[type]} />
        ))}

        {/* кнопка-стрелочка */}
        <button
          className={styles.expand_btn}
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-label={isExpanded ? t('navbarCollapse') : t('navbarExpand')}
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            className={`${styles.expand_icon} ${isExpanded ? styles.rotated : ''}`}
          >
            <path
              d='M6 9L12 15L18 9'
              stroke='currentColor'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
      </div>

      {/* мобайл — нижний ряд (раскрывается) */}
      <div className={styles.mobile_expandable}>
        <div className={styles.mobile_expandable_inner}>
          <div className={styles.divider} />
          <div className={styles.mobile_bottom}>
            {bottomItems.map((type) => (
              <TaskMenuBtn key={type} taskType={type} id={BLOCK_BTN_IDS[type]} />
            ))}
          </div>
        </div>
      </div>
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
      className={`${styles.task_btn} ${isDragging ? styles.dragging : ''}`}
    >
      <task.icon style={{minHeight: '16px', minWidth: '16px'}} width={16} height={16} />
      <span className={styles.task_label}>{t(task.label)}</span>
    </button>
  )
}
