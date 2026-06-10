'use client'

import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {RoadMapBlockType, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useRoadmapProgress} from '@/shared/ui/RoadMap/context/RoadmapProgressContext'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {type Edge, useReactFlow, useStore} from '@xyflow/react'
import {EyeOffIcon} from 'lucide-react'
import React, {useEffect, useRef} from 'react'
import styles from './NodeCard.module.scss'

const NON_COMPLETABLE = new Set<RoadMapBlockType>([
  RoadMapBlockType.ACTIVE_TEST,
  RoadMapBlockType.TEST_LINK,
  RoadMapBlockType.ENTRY_POINT,
  RoadMapBlockType.DIVIDER,
])

function getAncestorIds(
  nodeId: string,
  edges: Edge[],
  nodeLookup: Map<string, {data: unknown}>,
): string[] {
  const result: string[] = []
  const queue = [nodeId]
  const visited = new Set<string>([nodeId])

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      if (edge.target === current && !visited.has(edge.source)) {
        visited.add(edge.source)
        const nodeData = nodeLookup.get(edge.source)?.data as RoadNodeData | undefined
        if (nodeData?.type && !NON_COMPLETABLE.has(nodeData.type)) {
          result.push(edge.source)
        }
        queue.push(edge.source)
      }
    }
  }
  return result
}

interface NodeCardProps {
  nodeId: string
  children: React.ReactNode
  isSelected: boolean
  useMini?: boolean
}

export default function NodeCard({nodeId, children, isSelected, useMini = false}: NodeCardProps) {
  const {getNode, setCenter} = useReactFlow()
  const isPaywallMode = useTypedSelector((state) => state.roadmapUISlice.isPaywallMode)
  const isView = useViewMode() === 'view'
  const {completedNodeIds, toggleNode, markCompleted, canComplete} = useRoadmapProgress()
  const ref = useRef<HTMLDivElement>(null)
  const validationError = useStore(
    (s) => (s.nodeLookup.get(nodeId)?.data as RoadNodeData & {validationError?: string | null})?.validationError ?? null
  )
  const nodeType = useStore(
    (s) => (s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.type
  )
  const edges = useStore((s) => s.edges)
  const nodeLookup = useStore((s) => s.nodeLookup)

  const hasError = !!validationError
  const isHidden = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.isPaywallHidden ?? false) as boolean
  )
  const isCompleted = isView && completedNodeIds.has(nodeId)
  const isCompletable = canComplete && !NON_COMPLETABLE.has(nodeType as RoadMapBlockType)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const addNodrag = () => {
      el.querySelectorAll<HTMLElement>('input, textarea, select, [contenteditable="true"]').forEach((node) => {
        node.classList.add('nodrag')
      })
    }
    addNodrag()
    const observer = new MutationObserver(addNodrag)
    observer.observe(el, {subtree: true, childList: true})
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      onDoubleClick={(e) => {
        if (isView) {
          e.stopPropagation()
          if (isCompletable) {
            if (isCompleted) {
              // Uncomplete just this node
              toggleNode(nodeId)
            } else {
              // Complete this node + all ancestors that aren't already done
              const ancestors = getAncestorIds(nodeId, edges, nodeLookup as Map<string, {data: unknown}>)
              const toMark = [nodeId, ...ancestors].filter((id) => !completedNodeIds.has(id))
              if (toMark.length > 0) markCompleted(toMark)
            }
          }
          return
        }
        const node = getNode(nodeId)
        if (!node) return
        const {position, measured} = node
        if (!position || !measured) return
        const {width = 420, height = 200} = measured
        setCenter(position.x + width / 2, position.y + height / 2, {zoom: 1, duration: 500})
      }}
      className={[
        styles.container,
        isSelected ? styles.selected : '',
        useMini ? styles.mini : '',
        isHidden && isPaywallMode ? styles.blurred : '',
        isHidden ? styles.hidden : '',
        isView ? 'nopan nodrag' : '',
        hasError && !isView ? styles.none_border : '',
        isCompleted ? styles.completed : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      {hasError && !isView && (
        <svg className={styles.error_svg} aria-hidden>
          <rect width='100%' height='100%' rx='14' ry='14' className={styles.error_rect} />
        </svg>
      )}
      {isHidden && (
        <div className={`${styles.paywallBadge} ${isPaywallMode ? styles.paywallBadgeEdit : ''}`}>
          <EyeOffIcon size={12} />
        </div>
      )}
    </div>
  )
}
