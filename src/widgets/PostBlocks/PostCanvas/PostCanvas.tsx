'use client'

import {PostBlock} from '@/entities/store/slices/post.slice'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {useDroppable} from '@dnd-kit/core'
import {SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical} from 'lucide-react'
import {PostBlockEditor} from '../PostBlockEditor'
import styles from './PostCanvas.module.scss'

// ── Sortable block row ────────────────────────────────────────
function SortableBlock({block}: {block: PostBlock}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: block.id,
    data: {origin: 'canvas', blockId: block.id}
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1
      }}
      className={styles.sortable_row}
    >
      {/* Хэндл — только за него можно тянуть внутри канваса */}
      <button
        type='button'
        className={styles.drag_handle}
        {...attributes}
        {...listeners}
        aria-label='Переместить блок'
        // Предотвращаем горизонтальный скролл — drag только вертикально
        style={{touchAction: 'none'}}
      >
        <GripVertical size={15} />
      </button>
      <div className={styles.block_content}>
        <PostBlockEditor block={block} />
      </div>
    </div>
  )
}

// ── Drop zone (когда тянем из палитры) ───────────────────────
function PaletteDropZone({isOver}: {isOver: boolean}) {
  return (
    <div className={`${styles.drop_zone} ${isOver ? styles.drop_zone_over : ''}`}>
      <span className={styles.drop_zone_text}>{isOver ? 'Отпустите чтобы добавить' : '+ Перетащите блок сюда'}</span>
    </div>
  )
}

// ── Canvas ────────────────────────────────────────────────────
interface Props {
  isDraggingFromPalette: boolean
}

export function PostCanvas({isDraggingFromPalette}: Props) {
  const blocks = useTypedSelector((s) => s.postSlice.blocks)

  const {setNodeRef, isOver} = useDroppable({id: 'canvas-drop'})

  return (
    <div className={styles.canvas_wrap}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={styles.canvas}>
          {blocks.map((block) => (
            <SortableBlock key={block.id} block={block} />
          ))}

          {/* Пустое состояние или drop-hint */}
          {blocks.length === 0 && !isDraggingFromPalette && (
            <div className={styles.empty}>
              <span className={styles.empty_mark}>+</span>
              <p className={styles.empty_text}>Перетащите блок из панели справа</p>
            </div>
          )}

          {isDraggingFromPalette && <PaletteDropZone isOver={isOver} />}
        </div>
      </SortableContext>
    </div>
  )
}
