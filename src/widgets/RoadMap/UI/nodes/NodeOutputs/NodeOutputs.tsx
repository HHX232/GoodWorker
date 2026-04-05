'use client'
import {BlockRoadParam} from '@/shared/types/RoadMap/RoadMap.types'
import {Handle, Position} from '@xyflow/react'
import React from 'react'
import styles from './NodeOutputs.module.scss'

export default function NodeOutputs({
  children,
  nodeId,
  hidden
}: {
  children: React.ReactNode
  nodeId: string
  hidden?: boolean
}) {
  return (
    <div className={styles.outputs}>
      <Handle
        position={Position.Right}
        id={`${nodeId}-output`}
        type='source'
        className={styles.handle}
        style={hidden ? {opacity: 0, pointerEvents: 'none'} : {}}
      />
      {!hidden && children}
    </div>
  )
}

export function NodeOutput({output, nodeId}: {output: BlockRoadParam; nodeId: string}) {
  if (output.name.trim() == '') return
  return (
    <div className={styles.outputRow}>
      {output.name.trim() !== '' && <p className={styles.outputLabel}>{output.name}</p>}
    </div>
  )
}
