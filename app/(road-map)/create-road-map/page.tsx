'use client'

import CreateRoadMapPage from '@/_pages/TeacherPages/CreateRoadMapPage/CreateRoadMapPage'
import {ReactFlowProvider} from '@xyflow/react'

function RoadMapPage() {
  return (
    <ReactFlowProvider>
      <CreateRoadMapPage />
    </ReactFlowProvider>
  )
}

export default RoadMapPage
