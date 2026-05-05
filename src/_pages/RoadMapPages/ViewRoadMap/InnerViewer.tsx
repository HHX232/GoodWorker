'use client'
import {ViewModeContext} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {RoadmapReviewBar} from '@/shared/ui/RoadMap/RoadmapReviewBar/RoadmapReviewBar'
import DeletableEdge from '@/widgets/RoadMap/UI/nodes/DeletableEdge/DeletableEdge'
import NodeComponent from '@/widgets/RoadMap/UI/nodes/NodeComponent/NodeComponent'
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const nodeTypes = {FlowScrapeNode: NodeComponent}
const edgeTypes = {default: DeletableEdge}

interface RoadMapViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: Node<any>[]
  edges: Edge[]
  roadmapId: string
  initialAvgRating?: number
}

function InnerFlow({nodes: initialNodes, edges: initialEdges, roadmapId, initialAvgRating}: RoadMapViewerProps) {
  const [nodes, , onNodesChange] = useNodesState(
    initialNodes.map((n) => ({...n, type: 'FlowScrapeNode', dragging: false, selected: false}))
  )
  const [edges, , onEdgesChange] = useEdgesState(
    initialEdges.map((e) => ({
      ...e,
      type: 'default',
      animated: true,
      selectable: false,
      markerEnd: {type: MarkerType.ArrowClosed, width: 22, height: 22, color: '#868897'}
    }))
  )

  return (
    <div style={{width: '100%', height: '100vh', backgroundColor: '#FFF'}}>
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
        fitViewOptions={{padding: 0.2, duration: 400}}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} />
        <Controls position='top-left' />
        <Panel
          position='top-right'
          style={{
            left: '56px',
            right: '10px',
            top: '10px',
            margin: 0,
            pointerEvents: 'auto',
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <RoadmapReviewBar roadmapId={roadmapId} initialAvgRating={initialAvgRating} />
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default function RoadMapViewer(props: RoadMapViewerProps) {
  return (
    <ViewModeContext.Provider value='view'>
      <ReactFlowProvider>
        <InnerFlow {...props} />
      </ReactFlowProvider>
    </ViewModeContext.Provider>
  )
}
