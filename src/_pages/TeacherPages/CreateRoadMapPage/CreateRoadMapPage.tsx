'use client'

import { CreateRoadNavbar, CreateRoadZone } from '@/widgets/RoadMap/UI'
import { RoadItem } from '@/widgets/RoadMap/UI/CreateRoadZone/CreateRoadZone'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { useState } from 'react'
import styles from './CreateRoadMapPage.module.scss'

function CreateRoadMapPage() {
  const [roads, setRoads] = useState<RoadItem[]>([])
  const [activeRoad, setActiveRoad] = useState<RoadItem | null>(null)

  return (
    <DndContext collisionDetection={closestCenter}>
      <div className={styles.main}>
        <CreateRoadNavbar />
        <CreateRoadZone roads={roads} />
      </div>

      <DragOverlay>
        {activeRoad ? <div>{activeRoad.name}</div> : null}
      </DragOverlay>
    </DndContext>
  )
}


export default CreateRoadMapPage