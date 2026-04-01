'use client'
import {BlockRoadParam, RoadMapParamType, RoadNode, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useReactFlow, useStore} from '@xyflow/react'
import {useCallback} from 'react'
import SelectMyTestParam from '../../Params/SelectMyTestParam/SelectMyTestParam'
import styles from './NodeParamField.module.scss'
import HelpTextParam from '../../Params/HelpTextParam/HelpTextParam'

function StringParam({
  param,
  value,
  updateNodeParamValue,
  disabled
}: {
  param: BlockRoadParam
  value: string
  updateNodeParamValue: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{param.name}</label>
      <input
        className={styles.stringInput}
        value={value ?? ''}
        disabled={disabled}
        placeholder={param.helpText ?? ''}
        onChange={(e) => updateNodeParamValue(e.target.value)}
      />
      {param.helpText && <span className={styles.helpText}>{param.helpText}</span>}
    </div>
  )
}

function SelectParam({
  param,
  value,
  updateNodeParamValue,
  disabled
}: {
  param: BlockRoadParam
  value: string
  updateNodeParamValue: (v: string) => void
  disabled?: boolean
}) {
  const options: {label: string; value: string}[] = param.options ?? []
  return (
    <div className={styles.field}>
      <label className={styles.label}>{param.name}</label>
      <select
        className={styles.select}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => updateNodeParamValue(e.target.value)}
      >
        <option value=''>{param.helpText ?? 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Main switch ─────────────────────────────────────────────────────────────

export default function NodeParamField({
  param,
  nodeId,
  disabled
}: {
  param: BlockRoadParam
  nodeId: string
  disabled?: boolean
}) {
  const {updateNodeData, getNode} = useReactFlow()
  const node = getNode(nodeId) as RoadNode
  const value = useStore((s) => (s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.inputs?.[param.name] ?? '')

  const updateNodeParamValue = useCallback(
    (newValue: string) => {
      updateNodeData(nodeId, {
        inputs: {
          ...node?.data?.inputs,
          [param.name]: newValue
        }
      })
    },
    [node?.data?.inputs, nodeId, param.name, updateNodeData]
  )

  switch (param.type) {
    case RoadMapParamType.NUMBER:
      return <StringParam param={param} value={value} updateNodeParamValue={updateNodeParamValue} disabled={disabled} />
    case RoadMapParamType.SELECT:
      return <SelectParam param={param} value={value} updateNodeParamValue={updateNodeParamValue} disabled={disabled} />
    case RoadMapParamType.STRING:
      return (
        <HelpTextParam param={param} value={value} updateNodeParamValue={updateNodeParamValue} disabled={disabled} />
      )
    case RoadMapParamType.HIDE:
      return <></>
    case RoadMapParamType.SELECT_MY_TEST:
      return (
        <SelectMyTestParam
          param={param}
          value={value}
          updateNodeParamValue={updateNodeParamValue}
          disabled={disabled}
        />
      )
    default:
      return <p className={styles.notImplemented}>Not implemented: {param.type}</p>
  }
}
