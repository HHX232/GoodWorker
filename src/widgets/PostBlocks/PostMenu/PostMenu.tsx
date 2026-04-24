'use client'

import {useActions} from '@/features/hooks/store/useActions'
import {PostBlockRegistry} from '@/features/Post/PostBlockRegistry'
import {PostBlockType} from '@/shared/types/Post/Post.type'
import {useDraggable} from '@dnd-kit/core'
import {PlusIcon, XIcon} from 'lucide-react'
import {RefObject, useEffect, useState} from 'react'
import styles from './PostMenu.module.scss'

interface PostMenuProps {
  mainContentRef: RefObject<HTMLDivElement | null>
}

export const PostMenu = ({mainContentRef}: PostMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [fabTop, setFabTop] = useState<number | null>(null)

  useEffect(() => {
    const update = () => {
      const el = mainContentRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const fabH = 48
      const desired = rect.bottom + 12
      setFabTop(Math.min(desired, window.innerHeight - 130 - fabH))
    }
    update()
    const sc = mainContentRef.current?.closest('.default_content') ?? window
    sc.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      sc.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [mainContentRef])

  const fabStyle = fabTop !== null ? {top: fabTop} : {}
  return (
    <>
      {/* Desktop */}
      <div className={styles.desktop_menu}>
        <h3 className={styles.menu_title}>Перетащите блок</h3>
        <ul className={styles.menu_list}>
          {Object.values(PostBlockType).map((type) => (
            <li key={type}>
              <DesktopPostButton blockType={type} />
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile */}
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
            {Object.values(PostBlockType).map((type) => (
              <MobilePostButton key={type} blockType={type} onAdd={() => setIsOpen(false)} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

const DesktopPostButton = ({blockType}: {blockType: PostBlockType}) => {
  const meta = PostBlockRegistry[blockType]
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `palette-${blockType}`,
    data: {type: blockType, origin: 'palette'}
  })
  return (
    <div className={styles.block_button_box}>
      <div
        ref={setNodeRef}
        className={`${styles.block_icon} ${isDragging ? styles.dragging : ''}`}
        {...listeners}
        {...attributes}
      >
        {meta.icon}
      </div>
      <div className={styles.block_info}>
        <span className={styles.block_label}>{meta.label}</span>
        <span className={styles.block_desc}>{meta.description}</span>
      </div>
    </div>
  )
}

const MobilePostButton = ({blockType, onAdd}: {blockType: PostBlockType; onAdd: () => void}) => {
  const meta = PostBlockRegistry[blockType]
  const {addPostBlock} = useActions()
  return (
    <button
      className={styles.mobile_block_btn}
      onClick={() => {
        addPostBlock(blockType)
        onAdd()
      }}
    >
      <div className={styles.mobile_block_icon}>{meta.icon}</div>
      <span className={styles.mobile_block_label}>{meta.label}</span>
    </button>
  )
}
