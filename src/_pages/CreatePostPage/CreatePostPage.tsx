/* eslint-disable @typescript-eslint/no-unused-expressions */
'use client'

import {useSavePost} from '@/features/hooks/Post/useSavePost'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {PostBlockRegistry} from '@/features/Post/PostBlockRegistry'
import {PostBlockType} from '@/shared/types/Post/Post.type'
import {TextInputUI} from '@/shared/ui/inputs'
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
import {useTranslations} from 'next-intl'
import {useSearchParams} from 'next/navigation'
import {useEffect, useRef, useState} from 'react'
import {toast} from 'sonner'
import styles from './CreatePostPage.module.scss'

function CreatePostPage({id}: {id?: string}) {
  const t = useTranslations('CreatePostPage')
  const tMenu = useTranslations('postMenu')
  const searchParams = useSearchParams()
  const existingId = searchParams.get('id') ?? undefined
  const activeId = id || existingId
  const mainContentRef = useRef<HTMLDivElement>(null)

  const {setPostTitle, setPostVisibility, addPostBlock, reorderPostBlocks, setPostCategoryIds} = useActions()
  const {title, visibility, categoryIds} = useTypedSelector((s) => s.postSlice)
  const blocks = useTypedSelector((s) => s.postSlice.blocks)

  const {save, status} = useSavePost(activeId)
  const isLoading = status === 'loading'

  const [draggingType, setDraggingType] = useState<PostBlockType | null>(null)

  useEffect(() => {
    isLoading ? toast.loading(t('publishing')) : toast.dismiss()
  }, [isLoading])
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
          <h1>{activeId ? t('editPost') : t('newPost')}</h1>

          <div className={styles.form}>
            <div className={styles.meta_form}>
              <TextInputUI
                theme='newWhite'
                placeholder={t('titlePlaceholder')}
                currentValue={title}
                onSetValue={setPostTitle}
              />

              <div className={styles.visibility_toggle}>
                {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
                  <button
                    key={v}
                    type='button'
                    className={`${styles.vis_btn} ${visibility === v ? styles.vis_active : ''}`}
                    onClick={() => setPostVisibility(v)}
                  >
                    {v === 'PUBLIC' ? t('visibilityPublic') : t('visibilityPrivate')}
                  </button>
                ))}
              </div>

              <CategorySelect
                placeholder={t('categoryPlaceholder')}
                canSelectMany={false}
                value={categoryIds}
                // maxLevel={1}
                onChange={setPostCategoryIds}
              />
            </div>

            <PostCanvas isDraggingFromPalette={!!draggingType} />
          </div>

          <button type='button' className={styles.publish_btn} disabled={isLoading} onClick={save}>
            {isLoading ? t('publishing') : activeId ? t('saveChanges') : t('publishPost')}
          </button>
        </div>

        <PostMenu mainContentRef={mainContentRef} />
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingType && (
          <div className={styles.drag_ghost}>
            {PostBlockRegistry[draggingType].icon}
            {tMenu(`${draggingType}_label`)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default CreatePostPage
