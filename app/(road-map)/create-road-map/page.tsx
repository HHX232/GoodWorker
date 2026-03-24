'use client'
import CreateRoadMapPage from '@/_pages/TeacherPages/CreateRoadMapPage/CreateRoadMapPage'
import { useActions } from '@/features/hooks/store/useActions'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useState } from 'react'

function RoadMapPage() {
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
    if (origin === 'palette') addBlock(type)
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <CreateRoadMapPage />
    </DndContext>
  )
}

export default RoadMapPage
