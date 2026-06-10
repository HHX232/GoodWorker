'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface RoadmapProgressContextValue {
  completedNodeIds: Set<string>
  toggleNode: (nodeId: string) => void
  markCompleted: (nodeIds: string[]) => void
  canComplete: boolean
}

const RoadmapProgressContext = createContext<RoadmapProgressContextValue>({
  completedNodeIds: new Set(),
  toggleNode: () => {},
  markCompleted: () => {},
  canComplete: false,
})

export function RoadmapProgressProvider({
  roadmapId,
  canComplete,
  children,
}: {
  roadmapId: string
  canComplete: boolean
  children: React.ReactNode
}) {
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!canComplete) return
    fetch(`/api/roadmap/${roadmapId}/progress`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.completedSteps)) {
          setCompletedNodeIds(new Set(data.completedSteps))
        }
      })
      .catch(() => {})
  }, [roadmapId, canComplete])

  // Toggle a single node (for uncomplete)
  const toggleNode = useCallback(
    (nodeId: string) => {
      if (!canComplete) return

      setCompletedNodeIds((prev) => {
        const next = new Set(prev)
        if (next.has(nodeId)) next.delete(nodeId)
        else next.add(nodeId)
        return next
      })

      fetch(`/api/roadmap/${roadmapId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.completedSteps)) {
            setCompletedNodeIds(new Set(data.completedSteps))
          }
        })
        .catch(() => {
          setCompletedNodeIds((prev) => {
            const next = new Set(prev)
            if (next.has(nodeId)) next.delete(nodeId)
            else next.add(nodeId)
            return next
          })
        })
    },
    [roadmapId, canComplete],
  )

  // Bulk mark multiple nodes as completed (always adds, no toggle)
  const markCompleted = useCallback(
    (nodeIds: string[]) => {
      if (!canComplete || nodeIds.length === 0) return

      setCompletedNodeIds((prev) => {
        const next = new Set(prev)
        nodeIds.forEach((id) => next.add(id))
        return next
      })

      fetch(`/api/roadmap/${roadmapId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.completedSteps)) {
            setCompletedNodeIds(new Set(data.completedSteps))
          }
        })
        .catch(() => {
          setCompletedNodeIds((prev) => {
            const next = new Set(prev)
            nodeIds.forEach((id) => next.delete(id))
            return next
          })
        })
    },
    [roadmapId, canComplete],
  )

  return (
    <RoadmapProgressContext.Provider value={{ completedNodeIds, toggleNode, markCompleted, canComplete }}>
      {children}
    </RoadmapProgressContext.Provider>
  )
}

export function useRoadmapProgress() {
  return useContext(RoadmapProgressContext)
}
