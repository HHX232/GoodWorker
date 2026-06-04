'use client'
import {TaskBlockRegistry} from '@/features'
import {useActions} from '@/features/hooks/store/useActions'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useDraggable} from '@dnd-kit/core'
import {CoinsIcon, PlusIcon, XIcon} from 'lucide-react'
import {RefObject, useEffect, useState} from 'react'
import styles from './TaskMenu.module.scss'

interface TaskMenuProps {
  mainContentRef: RefObject<HTMLDivElement | null>
}
const TASK_BTN_IDS: Partial<Record<TaskBlockType, string>> = {
  [TaskBlockType.CHOOSE_OPTION]:  'test-btn-choose-option',
  [TaskBlockType.FREE_ANSWER]:    'test-btn-free-answer',
  [TaskBlockType.FILL_TEXT]:      'test-btn-fill-text',
  [TaskBlockType.MATCH_PAIRS]:    'test-btn-match-pairs',
  [TaskBlockType.SEQUENCE]:       'test-btn-sequence',
  [TaskBlockType.HIGHLIGHT_TEXT]: 'test-btn-highlight',
  [TaskBlockType.WORD_SCRAMBLE]:  'test-btn-word-scramble',
  [TaskBlockType.DIALOGUE]:       'test-btn-dialogue',
  [TaskBlockType.INFO_TEXT]:      'test-btn-info-text',
  [TaskBlockType.INFO_MEDIA]:     'test-btn-info-media',
  [TaskBlockType.INFO_AUDIO]:     'test-btn-info-audio',
}

export const TaskMenu = ({mainContentRef}: TaskMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [fabTop, setFabTop] = useState<number | null>(null)
  const [fabLeft, setFabLeft] = useState<number>(0)
  const [fabWidth, setFabWidth] = useState<number>(0)

  // Этот useEffect — позиционирование, не resize-детектор
  useEffect(() => {
    const updateFabPosition = () => {
      const el = mainContentRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const fabHeight = 48
      const margin = 12
      const maxBottom = window.innerHeight - 130 - fabHeight

      const desiredTop = rect.bottom + margin

      const top = desiredTop > window.innerHeight - 100 ? maxBottom : desiredTop

      setFabTop(top)
      setFabLeft(rect.left)
      setFabWidth(rect.width)
    }

    updateFabPosition()

    const scrollContainer = mainContentRef.current?.closest('.default_content') ?? window
    scrollContainer.addEventListener('scroll', updateFabPosition)
    window.addEventListener('resize', updateFabPosition)

    return () => {
      scrollContainer.removeEventListener('scroll', updateFabPosition)
      window.removeEventListener('resize', updateFabPosition)
    }
  }, [mainContentRef])

  const fabStyle =
    fabTop !== null
      ? {
          position: 'fixed' as const,
          top: fabTop,
          left: fabLeft + fabWidth / 2,
          transform: 'translateX(-50%)'
        }
      : {}

  return (
    <>
      {/* ── Десктоп сайдбар ── */}
      <div className={styles.desktop_menu} id="test-task-menu">
        <h3 className={styles.task_title}>Перетащите блок</h3>
        <ul className={styles.task_list}>
          {Object.values(TaskBlockType).map((type) => (
            <li key={type}>
              <DesktopTaskButton taskType={type} id={TASK_BTN_IDS[type]} />
            </li>
          ))}
        </ul>
      </div>

      {/* ── Мобилка: FAB + оверлей + bottom sheet ── */}
      <div className={styles.mobile_menu}>
        <button className={styles.fab} style={fabStyle} onClick={() => setIsOpen(true)}>
          <PlusIcon size={22} />
          <span>Добавить блок</span>
        </button>

        <div className={`${styles.overlay} ${isOpen ? styles.overlay_visible : ''}`} onClick={() => setIsOpen(false)} />

        <div className={`${styles.bottom_sheet} ${isOpen ? styles.bottom_sheet_open : ''}`}>
          <div className={styles.sheet_handle} />
          <div className={styles.sheet_header}>
            <h3 className={styles.sheet_title}>Добавить блок</h3>
            <button className={styles.sheet_close} onClick={() => setIsOpen(false)}>
              <XIcon size={18} />
            </button>
          </div>
          <div className={styles.sheet_grid}>
            {Object.values(TaskBlockType).map((type) => (
              <MobileTaskButton key={type} taskType={type} onAdd={() => setIsOpen(false)} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

const DesktopTaskButton = ({taskType, id}: {taskType: TaskBlockType; id?: string}) => {
  const task = TaskBlockRegistry[taskType]

  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `palette-${taskType}`,
    data: {type: taskType, origin: 'palette'}
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

const MobileTaskButton = ({taskType, onAdd}: {taskType: TaskBlockType; onAdd: () => void}) => {
  const task = TaskBlockRegistry[taskType]
  const {addBlock} = useActions()

  const handleTap = () => {
    addBlock(taskType)
    onAdd()
  }

  return (
    <button className={styles.mobile_block_btn} onClick={handleTap}>
      <div className={styles.mobile_block_icon}>{task.icon}</div>
      <span className={styles.mobile_block_label}>{task.label}</span>
      {task.credits !== 0 && (
        <div className={styles.mobile_block_credits}>
          <CoinsIcon size={11} />
          <span>{task.credits}</span>
        </div>
      )}
    </button>
  )
}
