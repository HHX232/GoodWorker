'use client'
import CreateRoadMapPage from '@/_pages/TeacherPages/CreateRoadMapPage/CreateRoadMapPage'
import {ReactFlowProvider} from '@xyflow/react'

export function CreateRoadMapWrapper() {
  return (
    <ReactFlowProvider>
      <CreateRoadMapPage />
    </ReactFlowProvider>
  )
}
