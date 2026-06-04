'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {SequencePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors} from '@dnd-kit/core'
import {SortableContext, arrayMove, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {nanoid} from '@reduxjs/toolkit'
import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import styles from './SequenceEditor.module.scss'

interface Props {
  blockId: string
  payload: SequencePayload
}

function SequenceEditor({blockId, payload}: Props) {
  const t = useTranslations('TaskEditors')
  const {updateBlockPayload} = useActions()

  const update = (updated: Partial<SequencePayload>) => {
    updateBlockPayload({
      id: blockId,
      payload: {...payload, ...updated}
    })
  }

  const addItem = () => {
    update({
      items: [...payload.items, {id: nanoid(), text: ''}]
    })
  }

  const removeItem = (id: string) => {
    update({items: payload.items.filter((i) => i.id !== id)})
  }

  const updateItemText = (id: string, text: string) => {
    update({
      items: payload.items.map((i) => (i.id === id ? {...i, text} : i))
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = payload.items.findIndex((i) => i.id === active.id)
    const newIndex = payload.items.findIndex((i) => i.id === over.id)
    update({items: arrayMove(payload.items, oldIndex, newIndex)})
  }

  const sensors = useSensors(useSensor(PointerSensor))

  const [previewItems, setPreviewItems] = useState<SequencePayload['items']>([])

  useEffect(() => {
    setPreviewItems([...payload.items].sort(() => Math.random() - 0.5))
  }, [payload.items.length, payload.items])

  const handlePreviewDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = previewItems.findIndex((i) => i.id === active.id)
    const newIndex = previewItems.findIndex((i) => i.id === over.id)
    setPreviewItems((prev) => arrayMove(prev, oldIndex, newIndex))
  }

  return (
    <div className={styles.editor_box}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={payload.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.items_list}>
            {payload.items.map((item, index) => (
              <SortableItem
                key={item.id}
                id={item.id}
                index={index}
                text={item.text}
                placeholder={t('itemPlaceholder', {n: index + 1})}
                onTextChange={(val) => updateItemText(item.id, val)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button type='button' className={styles.add_btn} onClick={addItem}>
        {t('addItem')}
      </button>

      {payload.items.length >= 2 && (
        <div className={styles.preview_box}>
          <span className={styles.preview_label}>{t('studentPreview')}</span>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePreviewDragEnd}>
            <SortableContext items={previewItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.items_list}>
                {previewItems.map((item, index) => (
                  <SortablePreviewItem key={item.id} id={item.id} index={index} text={item.text} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}

interface SortableItemProps {
  id: string
  index: number
  text: string
  placeholder: string
  onTextChange: (val: string) => void
  onRemove: () => void
}

function SortableItem({id, index, text, placeholder, onTextChange, onRemove}: SortableItemProps) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={`${styles.item_row} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.drag_handle} {...listeners} {...attributes}>
        ⠿
      </div>
      <span className={styles.item_index}>{index + 1}</span>
      <input
        className={styles.item_input}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={placeholder}
      />
      <button type='button' className={styles.remove_btn} onClick={onRemove}>
        ✕
      </button>
    </div>
  )
}

interface SortablePreviewItemProps {
  id: string
  index: number
  text: string
}

function SortablePreviewItem({id, index, text}: SortablePreviewItemProps) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={`${styles.preview_item} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.drag_handle} {...listeners} {...attributes}>
        ⠿
      </div>
      <span className={styles.preview_item_text}>{text || '...'}</span>
    </div>
  )
}

export default SequenceEditor
