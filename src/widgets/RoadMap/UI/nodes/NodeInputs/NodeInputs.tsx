import {BlockRoadParam, RoadMapParamType} from '@/shared/types/RoadMap/RoadMap.types'
import {Handle, Position} from '@xyflow/react'
import React from 'react'
import NodeParamField from '../NodeParamField/NodeParamField'
import styles from './NodeInputs.module.scss'

export default function NodeInputs({
  children,
  nodeId,
  hidden
}: {
  children: React.ReactNode
  nodeId: string
  hidden?: boolean
}) {
  return (
    <div className={styles.inputs}>
      <Handle
        position={Position.Left}
        id={`${nodeId}-input`}
        type='target'
        className={styles.handle}
        style={hidden ? {opacity: 0, pointerEvents: 'none'} : {}}
      />
      {!hidden && children}
    </div>
  )
}
export function NodeInput({input, nodeId}: {input: BlockRoadParam; nodeId: string}) {
  return (
    <div style={{display: input.type === RoadMapParamType.HIDE ? 'none' : ''}} className={styles.inputRow}>
      <NodeParamField nodeId={nodeId} param={input} />
    </div>
  )
}
