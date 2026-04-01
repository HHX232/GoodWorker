/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {createRoadNode} from '@/shared/helpers/Node/CreateFlowNode'
import {RoadMapBlockType, RoadNode, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useDroppable} from '@dnd-kit/core'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  getOutgoers,
  MarkerType,
  Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {EyeOffIcon, LockIcon} from 'lucide-react'
import {useCallback, useEffect} from 'react'
import {AutoLayoutButton} from '../../AutoLayoutButton/AutoLayoutButton'
import DeletableEdge from '../nodes/DeletableEdge/DeletableEdge'
import NodeComponent from '../nodes/NodeComponent/NodeComponent'
import styles from './CreateRoadZone.module.scss'

const nodeTypes = {FlowScrapeNode: NodeComponent}
const edgeTypes = {default: DeletableEdge}
const snapGrid: [number, number] = [50, 50]
const fitViewOptions = {padding: 1.5}

function CreateRoadZoneInner() {
  const {isOver, setNodeRef: setDropRef} = useDroppable({id: 'droppable-canvas'})
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RoadNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const {screenToFlowPosition, getNodes, getEdges, updateNodeData} = useReactFlow()

  const {toggleRoadmapPaywallMode} = useActions()
  const isPaywallMode = useTypedSelector((state) => state.roadmapUISlice.isPaywallMode)

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }, [])

  useEffect(() => {
    if (nodes.some((el) => el.data.type === RoadMapBlockType.ENTRY_POINT)) return

    const center = screenToFlowPosition({
      x: window.innerWidth / 2.2,
      y: window.innerHeight / 2.7
    })

    const newNode = createRoadNode(RoadMapBlockType.ENTRY_POINT, center)
    setNodes((nds) => [...nds, newNode])
  }, [])
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (!event.dataTransfer) return
      const rawType = event.dataTransfer.getData('application/reactflow')
      if (!rawType) return
      const type = rawType as RoadMapBlockType
      const position = screenToFlowPosition({x: event.clientX, y: event.clientY})
      const newNode = createRoadNode(type, position)
      setNodes((nds) => [...nds, newNode])
    },
    [setNodes, screenToFlowPosition]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            markerEnd: {type: MarkerType.ArrowClosed, width: 22, height: 22, color: '#868897'}
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      if (connection.source === connection.target) return false
      const source = nodes.find((n) => n.id === connection.source)
      const target = nodes.find((n) => n.id === connection.target)
      if (!source || !target) return false

      const hasCycle = (node: RoadNode, visited = new Set<string>()): boolean => {
        if (visited.has(node.id)) return false
        visited.add(node.id)
        const outgoers = getOutgoers(node, nodes, edges)
        for (const outgoer of outgoers) {
          if (outgoer.id === connection.source) return true
          if (hasCycle(outgoer, visited)) return true
        }
        return false
      }

      return !hasCycle(target)
    },
    [nodes, edges]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!isPaywallMode) return

      const allNodes = getNodes()
      const allEdges = getEdges()

      const collectDescendants = (nodeId: string, visited = new Set<string>()): Set<string> => {
        if (visited.has(nodeId)) return visited
        visited.add(nodeId)
        const children = getOutgoers({id: nodeId} as RoadNode, allNodes, allEdges)
        children.forEach((child) => collectDescendants(child.id, visited))
        return visited
      }

      const affectedIds = collectDescendants(node.id)
      const currentlyHidden = (node.data as RoadNodeData).isPaywallHidden ?? false

      affectedIds.forEach((id) => {
        updateNodeData(id, {isPaywallHidden: !currentlyHidden} as any)
      })
    },
    [isPaywallMode, getNodes, getEdges, updateNodeData]
  )

  return (
    <div
      ref={setDropRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 600,
        border: `2px dashed ${isOver ? '#6366f1' : '#d1d5db'}`,
        transition: 'border-color 0.2s',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {isPaywallMode && (
        <div className={styles.paywallBanner}>
          <EyeOffIcon size={14} />
          Режим paywall — нажмите на блок чтобы скрыть его и всё дерево после него
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitViewOptions={fitViewOptions}
        isValidConnection={isValidConnection}
        snapGrid={snapGrid}
        edgeTypes={edgeTypes}
        snapToGrid
      >
        <Controls position='top-left' />
        <Background variant={BackgroundVariant.Dots} gap={15} />
        <Panel position='top-right'>
          <div className={styles.panelRow}>
            <AutoLayoutButton />
            <button
              className={`${styles.paywallBtn} ${isPaywallMode ? styles.paywallBtnActive : ''}`}
              onClick={() => {
                toggleRoadmapPaywallMode()
              }}
              title='Режим paywall'
            >
              <LockIcon size={14} />
              {isPaywallMode ? 'Выйти' : 'Paywall'}
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default CreateRoadZoneInner
