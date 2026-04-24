'use client'

import {useSavePost} from '@/features/hooks/Post/useSavePost'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {PostBlockRegistry} from '@/features/Post/PostBlockRegistry'
import {PostBlockType} from '@/shared/types/Post/Post.type'
import {CategorySelect} from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import {PostCanvas} from '@/widgets/PostBlocks/PostCanvas/PostCanvas'
import {PostMenu} from '@/widgets/PostBlocks/PostMenu/PostMenu'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {useSearchParams} from 'next/navigation'
import {useRef, useState} from 'react'
import styles from './CreatePostPage.module.scss'

function CreatePostPage() {
  const searchParams = useSearchParams()
  const existingId = searchParams.get('id') ?? undefined
  const mainContentRef = useRef<HTMLDivElement>(null)

  const {setPostTitle, setPostVisibility, addPostBlock, reorderPostBlocks, setCategoryIds} = useActions()
  const {title, visibility, categoryIds} = useTypedSelector((s) => s.postSlice)
  const blocks = useTypedSelector((s) => s.postSlice.blocks)

  const {save, status, error} = useSavePost(existingId)
  const isLoading = status === 'loading'

  const [draggingType, setDraggingType] = useState<PostBlockType | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}))

  const handleDragStart = (e: DragStartEvent) => {
    const {origin, type} = e.active.data.current ?? {}
    if (origin === 'palette') setDraggingType(type)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const {active, over} = e
    setDraggingType(null)
    if (!over) return
    const {origin, type} = active.data.current ?? {}
    if (origin === 'palette' && (over.id === 'canvas-drop' || blocks.find((b) => b.id === over.id))) {
      addPostBlock(type)
    } else if (origin === 'canvas') {
      const aId = String(active.id),
        oId = String(over.id)
      if (aId !== oId) reorderPostBlocks({activeId: aId, overId: oId})
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`container default_content ${styles.content}`}>
        {/* <NavBar /> */}

        <div className={styles.main_content} ref={mainContentRef}>
          <h1>{existingId ? 'Редактировать пост' : 'Новый пост'}</h1>

          <div className={styles.form}>
            <div className={styles.meta_form}>
              <input
                className={styles.title_input}
                type='text'
                placeholder='Заголовок поста…'
                value={title}
                onChange={(e) => setPostTitle(e.target.value)}
              />

              <div className={styles.visibility_toggle}>
                {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
                  <button
                    key={v}
                    type='button'
                    className={`${styles.vis_btn} ${visibility === v ? styles.vis_active : ''}`}
                    onClick={() => setPostVisibility(v)}
                  >
                    {v === 'PUBLIC' ? '🌍 Публичный' : '🔒 Приватный'}
                  </button>
                ))}
              </div>

              <CategorySelect
                placeholder='Выберите категорию поста'
                canSelectMany={false}
                value={categoryIds}
                onChange={setCategoryIds}
              />
            </div>

            <PostCanvas isDraggingFromPalette={!!draggingType} />
          </div>

          {error && <p className={styles.error_text}>{error}</p>}

          <button type='button' className={styles.publish_btn} disabled={isLoading} onClick={save}>
            {isLoading ? 'Публикация…' : existingId ? 'Сохранить изменения' : 'Опубликовать пост'}
          </button>
        </div>

        <PostMenu mainContentRef={mainContentRef} />
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingType && (
          <div className={styles.drag_ghost}>
            {PostBlockRegistry[draggingType].icon}
            {PostBlockRegistry[draggingType].label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default CreatePostPage
