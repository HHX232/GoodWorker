'use client'
import {useRoadmapAccess} from '@/features/hooks/Roadmap/useRoadmapAccess'
import {RoadmapNodeAccessType} from '@/features/services/RoadmapService.service'
import {RoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'
import {ViewModeContext} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {PurchaseAccessModal} from '@/shared/ui/RoadMap/PurchaseAccessModal/PurchaseAccessModal'
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
import {useState} from 'react'
import {useRoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'

const nodeTypes = {FlowScrapeNode: NodeComponent}
const edgeTypes = {default: DeletableEdge}

interface RoadMapViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: Node<any>[]
  edges: Edge[]
  roadmapId: string
  roadmapTitle?: string
  roadmapPrice?: number
  nodeAccessType?: RoadmapNodeAccessType | null
  initialAvgRating?: number
}

function BuyButton({price}: {price: number}) {
  const {openPurchaseModal} = useRoadmapAccessContext()
  const label = price > 0 ? `Приобрести роадмап · ${price} ₽` : 'Приобрести доступ'

  return (
    <button
      onClick={openPurchaseModal}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 16px',
        borderRadius: 10,
        border: 'none',
        background: '#141416',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Roboto, sans-serif',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(20,20,22,0.18)',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width='13' height='13' viewBox='0 0 24 24' fill='none'>
        <rect x='3' y='11' width='18' height='11' rx='2' stroke='currentColor' strokeWidth='2.2' />
        <path d='M7 11V7a5 5 0 0 1 10 0v4' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' />
      </svg>
      {label}
    </button>
  )
}

function InnerFlow({
  nodes: initialNodes,
  edges: initialEdges,
  roadmapId,
  roadmapPrice = 0,
  initialAvgRating,
}: RoadMapViewerProps) {
  const {hasAccess, nodeAccessType} = useRoadmapAccessContext()
  const showBuyButton = nodeAccessType !== null && !hasAccess

  const [nodes, , onNodesChange] = useNodesState(
    initialNodes.map((n) => ({...n, type: 'FlowScrapeNode', dragging: false, selected: false}))
  )
  const [edges, , onEdgesChange] = useEdgesState(
    initialEdges.map((e) => ({
      ...e,
      type: 'default',
      animated: true,
      selectable: false,
      markerEnd: {type: MarkerType.ArrowClosed, width: 22, height: 22, color: '#868897'},
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
            alignItems: 'center',
            gap: 10,
          }}
        >
          {showBuyButton && <BuyButton price={roadmapPrice} />}
          <RoadmapReviewBar roadmapId={roadmapId} initialAvgRating={initialAvgRating} />
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default function RoadMapViewer(props: RoadMapViewerProps) {
  const {data} = useRoadmapAccess(props.roadmapId)
  const hasAccess = data?.hasAccess ?? false
  const nodeAccessType = props.nodeAccessType ?? null
  const [purchaseOpen, setPurchaseOpen] = useState(false)

  return (
    <ViewModeContext.Provider value='view'>
      <RoadmapAccessContext.Provider
        value={{hasAccess, nodeAccessType, openPurchaseModal: () => setPurchaseOpen(true), roadmapId: props.roadmapId}}
      >
        <ReactFlowProvider>
          <InnerFlow {...props} />

          <PurchaseAccessModal
            isOpen={purchaseOpen}
            onClose={() => setPurchaseOpen(false)}
            roadmapId={props.roadmapId}
            price={props.roadmapPrice ?? 0}
            title={props.roadmapTitle ?? ''}
          />
        </ReactFlowProvider>
      </RoadmapAccessContext.Provider>
    </ViewModeContext.Provider>
  )
}
