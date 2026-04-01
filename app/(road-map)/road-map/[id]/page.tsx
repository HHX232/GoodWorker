/* eslint-disable react-hooks/rules-of-hooks */
'use client'
import {ViewModeContext} from '@/shared/ui/RoadMap/context/ViewModeContext'
import NodeComponent from '@/widgets/RoadMap/UI/nodes/NodeComponent/NodeComponent'
import {roadMapStorage} from '@/widgets/Tasks/Storage/roadMapStorage'
import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {useParams} from 'next/navigation'

const nodeTypes = {FlowScrapeNode: NodeComponent}

function RoadMapViewer({id}: {id: string}) {
  const map = roadMapStorage.getById(id)

  if (!map) return <div>Road map не найден</div>

  const restoredEdges = (map.edges ?? []).map((edge) => ({
    ...edge,
    type: 'default',
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 22,
      height: 22,
      color: '#868897'
    },
    deletable: false
  }))

  const restoredNodes = (map.nodes ?? []).map((node) => ({
    ...node,
    type: node.type ?? 'FlowScrapeNode',
    dragging: false,
    selected: false,
    deletable: false
  }))

  const [nodes, , onNodesChange] = useNodesState(restoredNodes)
  const [edges, , onEdgesChange] = useEdgesState(restoredEdges)

  return (
    <ViewModeContext.Provider value='view'>
      <div style={{width: '100%', height: '100vh'}}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          fitView
          minZoom={0.2}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={15} style={{zIndex: -1}} />
        </ReactFlow>
      </div>
    </ViewModeContext.Provider>
  )
}

export default function RoadMapPage() {
  const {id} = useParams() as {id: string}
  return (
    <ReactFlowProvider>
      <RoadMapViewer id={id} />
    </ReactFlowProvider>
  )
}
