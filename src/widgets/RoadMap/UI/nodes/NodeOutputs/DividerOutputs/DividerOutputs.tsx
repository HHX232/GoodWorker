/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import {RoadMapParamType, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {TextAreaUI} from '@/shared/ui/inputs'
import {Handle, Position, useReactFlow, useStore} from '@xyflow/react'
import {PlusIcon} from 'lucide-react'
import styles from './DividerOutputs.module.scss'

export default function DividerOutputs({nodeId}: {nodeId: string}) {
  const {updateNodeData, getNode} = useReactFlow()
  const outputs = useStore((s) => (s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.outputs ?? [])

  const addOutput = () => {
    const node = getNode(nodeId)
    const current = (node?.data as RoadNodeData)?.outputs ?? []
    updateNodeData(nodeId, {
      outputs: [...current, {name: `Выход ${current.length + 1}`, type: RoadMapParamType.STRING}]
    } as any)
  }

  const updateName = (index: number, name: string) => {
    const node = getNode(nodeId)
    const current = [...((node?.data as RoadNodeData)?.outputs ?? [])]
    current[index] = {...current[index], name}
    updateNodeData(nodeId, {outputs: current} as any)
  }

  const removeOutput = (index: number) => {
    const node = getNode(nodeId)
    const current = (node?.data as RoadNodeData)?.outputs ?? []
    updateNodeData(nodeId, {
      outputs: current.filter((_, i) => i !== index)
    } as any)
  }

  return (
    <div className={`${styles.outputs} nodrag nopan`}>
      {outputs.map((output, index) => (
        <div key={index} className={`${styles.outputRow} nodrag nopan`}>
          <TextAreaUI
            autoResize
            placeholder='Условие...'
            minRows={1}
            maxRows={3}
            extraClass={styles.extra_area}
            onSetValue={(value) => updateName(index, value)}
            currentValue={output.name}
          />

          {outputs.length > 1 && (
            <button className={styles.removeBtn} onClick={() => removeOutput(index)}>
              ×
            </button>
          )}

          {/* Обёртка выносит handle за правый край карточки */}
          <div className={styles.handleWrapper}>
            <Handle
              type='source'
              position={Position.Right}
              id={`${nodeId}-output-${index}`}
              className={styles.handle}
            />
          </div>
        </div>
      ))}

      <button className={styles.addBtn} onClick={addOutput}>
        <PlusIcon size={12} /> Добавить условие
      </button>
    </div>
  )
}
