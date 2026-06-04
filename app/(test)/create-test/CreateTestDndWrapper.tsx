'use client'
import CreateTestPage from '@/_pages/TeacherPages/CreateTestPage/CreateTestPage'
import {useActions} from '@/features/hooks/store/useActions'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {DragTaskPreview} from '@/shared/ui'
import {DndContext, DragEndEvent, DragOverlay, DragStartEvent} from '@dnd-kit/core'
import {useState} from 'react'

export function CreateTestDndWrapper() {
  const [draggingType, setDraggingType] = useState<TaskBlockType | null>(null)
  const {addBlock} = useActions()

  const handleDragStart = (event: DragStartEvent) => {
    const {type, origin} = event.active.data.current ?? {}
    if (origin === 'palette') setDraggingType(type)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingType(null)
    const {active, over} = event
    if (!over || over.id !== 'droppable-canvas') return
    const {type, origin} = active.data.current ?? {}
    if (origin === 'palette') {
      addBlock(type)
      window.dispatchEvent(new CustomEvent('test-block-dropped'))
    }
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <CreateTestPage />
      <DragOverlay dropAnimation={null}>
        {draggingType && <DragTaskPreview taskType={draggingType} />}
      </DragOverlay>
    </DndContext>
  )
}
