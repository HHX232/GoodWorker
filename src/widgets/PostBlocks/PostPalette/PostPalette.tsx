'use client'

import {PostBlockType} from '@/shared/types/Post/Post.type'
import {useDraggable} from '@dnd-kit/core'
import styles from './PostPalette.module.scss'

const ITEMS: {type: PostBlockType; icon: string; label: string; desc: string}[] = [
  {type: PostBlockType.TEXT, icon: '¶', label: 'Текст', desc: 'Форматированный текст'},
  {type: PostBlockType.MEDIA, icon: '⬡', label: 'Медиа', desc: 'Фото или видео'},
  {type: PostBlockType.AUDIO, icon: '◉', label: 'Аудио', desc: 'Аудиозапись'},
  {type: PostBlockType.TEST_LINK, icon: '⊞', label: 'Тест', desc: 'Привязать тест'}
]

function PaletteItem({type, icon, label, desc}: (typeof ITEMS)[0]) {
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
  return (
    <aside className={styles.palette}>
      <p className={styles.palette_title}>Блоки</p>
      <div className={styles.items}>
        {ITEMS.map((item) => (
          <PaletteItem key={item.type} {...item} />
        ))}
      </div>
      <p className={styles.palette_hint}>Перетащите блок влево</p>
    </aside>
  )
}
