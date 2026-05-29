'use client'

import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow, useStore} from '@xyflow/react'
import {EyeOffIcon} from 'lucide-react'
import React, {useEffect, useRef} from 'react'
import styles from './NodeCard.module.scss'

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
  const ref = useRef<HTMLDivElement>(null)
  const validationError = useStore(
    (s) => (s.nodeLookup.get(nodeId)?.data as RoadNodeData & {validationError?: string | null})?.validationError ?? null
  )

  const hasError = !!validationError
  const isHidden = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.isPaywallHidden ?? false) as boolean
  )

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
      onDoubleClick={() => {
        if (isView) return
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
        hasError && !isView ? styles.none_border : ''
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
