'use client'

import {PostBlockType} from '@/shared/types/Post/Post.type'
import {useDraggable} from '@dnd-kit/core'
import {useTranslations} from 'next-intl'
import styles from './PostPalette.module.scss'

type PaletteKey = 'text' | 'media' | 'audio' | 'test'

const ITEMS: {type: PostBlockType; icon: string; key: PaletteKey}[] = [
  {type: PostBlockType.TEXT, icon: '¶', key: 'text'},
  {type: PostBlockType.MEDIA, icon: '⬡', key: 'media'},
  {type: PostBlockType.AUDIO, icon: '◉', key: 'audio'},
  {type: PostBlockType.TEST_LINK, icon: '⊞', key: 'test'}
]

function PaletteItem({type, icon, label, desc}: {type: PostBlockType; icon: string; label: string; desc: string}) {
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `palette-${type}`,
    data: {origin: 'palette', type}
  })

  return (
    <div
      ref={setNodeRef}
      className={`${styles.item} ${isDragging ? styles.item_dragging : ''}`}
      {...listeners}
      {...attributes}
    >
      <span className={styles.item_icon}>{icon}</span>
      <span className={styles.item_info}>
        <span className={styles.item_label}>{label}</span>
        <span className={styles.item_desc}>{desc}</span>
      </span>
      <span className={styles.item_drag_hint}>⠿</span>
    </div>
  )
}

export function PostPalette() {
  const t = useTranslations('PostPalette')

  return (
    <aside className={styles.palette}>
      <p className={styles.palette_title}>{t('title')}</p>
      <div className={styles.items}>
        {ITEMS.map((item) => (
          <PaletteItem
            key={item.type}
            type={item.type}
            icon={item.icon}
            label={t(`${item.key}Label`)}
            desc={t(`${item.key}Desc`)}
          />
        ))}
      </div>
      <p className={styles.palette_hint}>{t('dragHint')}</p>
    </aside>
  )
}
