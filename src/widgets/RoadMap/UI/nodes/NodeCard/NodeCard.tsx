'use client'

import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useReactFlow, useStore} from '@xyflow/react'
import {EyeOffIcon} from 'lucide-react'
import React from 'react'
import styles from './NodeCard.module.scss'

export default function NodeCard({
  nodeId,
  children,
  isSelected,
  useMini = false
}: {
  nodeId: string
  children: React.ReactNode
  isSelected: boolean
  useMini?: boolean
}) {
  const {getNode, setCenter} = useReactFlow()
  const isPaywallMode = useTypedSelector((state) => state.roadmapUISlice.isPaywallMode)

  const isHidden = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.isPaywallHidden ?? false) as boolean
  )

  return (
    <div
      onDoubleClick={() => {
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
        isHidden ? styles.hidden : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}

      {isHidden && (
        <div className={`${styles.paywallBadge} ${isPaywallMode ? styles.paywallBadgeEdit : ''}`}>
          <EyeOffIcon size={12} />
        </div>
      )}
    </div>
  )
}
