'use client'
import {ViewModeContext} from '@/shared/ui/RoadMap/context/ViewModeContext'
import DeletableEdge from '@/widgets/RoadMap/UI/nodes/DeletableEdge/DeletableEdge'
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
const edgeTypes = {default: DeletableEdge}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InnerViewer({nodes: initialNodes, edges: initialEdges}: any) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div style={{width: '100%', height: '100vh'}}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} />
      </ReactFlow>
    </div>
  )
}

export default function RoadMapViewer() {
  const {id} = useParams() as {id: string}
  const map = roadMapStorage.getById(id)

  if (!map) return <div>не найден: {id}</div>

  const restoredEdges = map.edges.map((edge) => ({
    ...edge,
    type: 'default',
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 22,
      height: 22,
      color: '#868897'
    }
  }))

  const restoredNodes = map.nodes.map((node) => ({
    ...node,
    type: 'FlowScrapeNode',
    dragging: false,
    selected: false
  }))

  return (
    <ViewModeContext.Provider value='view'>
      <ReactFlowProvider>
        <InnerViewer nodes={restoredNodes} edges={restoredEdges} />
      </ReactFlowProvider>
    </ViewModeContext.Provider>
  )
}
