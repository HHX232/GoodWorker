'use client'

import { useDroppable } from "@dnd-kit/core"

export interface RoadItem {
  id: string
  name: string
  type: string
}

interface CreateRoadZoneProps {
  roads: RoadItem[]
  onRoadRemove?: (id: string) => void
}

function CreateRoadZone({ roads, onRoadRemove }: CreateRoadZoneProps) {
  const { setNodeRef } = useDroppable({
    id: 'create-road-zone',
    data: { type: 'road-zone', accepts: ['road'] }
  })

  return (
    <div ref={setNodeRef}>
      {roads.map((item) => (
        <div key={item.id}>
          <span>{item.name}</span>
          {onRoadRemove && (
            <button onClick={() => onRoadRemove(item.id)}>×</button>
          )}
        </div>
      ))}
    </div>
  )
}

export default CreateRoadZone