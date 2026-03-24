'use client'
import { useDraggable } from "@dnd-kit/core"

function TestRoadDropButton() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'test-road-drag-area',
    data: {
      type: 'road',
    },
  })
  
  const style = {
   
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    width: '100px', 
    height: '100px', 
    backgroundColor: isDragging ? 'blue' : 'red',
    cursor: 'grab',
  }
  
  return (
    <div 
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
    >
      TestRoadDragButton
    </div>
  )
}
export default TestRoadDropButton