'use client'

import {useActions} from '@/features/hooks/store/useActions'
import {PostBlockRegistry} from '@/features/Post/PostBlockRegistry'
import {PostBlockType} from '@/shared/types/Post/Post.type'
import {useDraggable} from '@dnd-kit/core'
import {PlusIcon, XIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {RefObject, useEffect, useState} from 'react'
import styles from './PostMenu.module.scss'

interface PostMenuProps {
  mainContentRef: RefObject<HTMLDivElement | null>
}

export const PostMenu = ({mainContentRef}: PostMenuProps) => {
  const t = useTranslations('postMenu')
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

    const ro = new ResizeObserver(update)
    if (mainContentRef.current) ro.observe(mainContentRef.current)

    return () => {
      sc.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [mainContentRef])

  const fabStyle = fabTop !== null ? {top: fabTop} : {}
  return (
    <>
      {/* Desktop */}
      <div className={styles.desktop_menu}>
        <h3 className={styles.menu_title}>{t('dragTitle')}</h3>
        <ul className={styles.menu_list}>
          {Object.values(PostBlockType).map((type) => (
            <li key={type}>
              <DesktopPostButton blockType={type} t={t} />
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile */}
      <div className={styles.mobile_menu}>
        <button className={styles.fab} style={fabStyle} onClick={() => setIsOpen(true)}>
          <PlusIcon size={22} />
          <span>{t('addTitle')}</span>
        </button>

        <div className={`${styles.overlay} ${isOpen ? styles.overlay_visible : ''}`} onClick={() => setIsOpen(false)} />

        <div className={`${styles.bottom_sheet} ${isOpen ? styles.bottom_sheet_open : ''}`}>
          <div className={styles.sheet_handle} />
          <div className={styles.sheet_header}>
            <h3 className={styles.sheet_title}>{t('addTitle')}</h3>
            <button className={styles.sheet_close} onClick={() => setIsOpen(false)}>
              <XIcon size={18} />
            </button>
          </div>
          <div className={styles.sheet_grid}>
            {Object.values(PostBlockType).map((type) => (
              <MobilePostButton key={type} blockType={type} onAdd={() => setIsOpen(false)} t={t} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

type TFn = (key: string) => string

const DesktopPostButton = ({blockType, t}: {blockType: PostBlockType; t: TFn}) => {
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
        <span className={styles.block_label}>{t(`${blockType}_label`)}</span>
        <span className={styles.block_desc}>{t(`${blockType}_desc`)}</span>
      </div>
    </div>
  )
}

const MobilePostButton = ({blockType, onAdd, t}: {blockType: PostBlockType; onAdd: () => void; t: TFn}) => {
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
      <span className={styles.mobile_block_label}>{t(`${blockType}_label`)}</span>
    </button>
  )
}
