'use client'
import {
  BlockRoadParam,
  RoadMapBlockType,
  RoadMapParamType,
  RoadNode,
  RoadNodeData
} from '@/shared/types/RoadMap/RoadMap.types'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow, useStore} from '@xyflow/react'
import {useCallback} from 'react'
import ActiveTestParam from '../../Params/ActiveTestBlock/ActiveTestParam'
import HelpTextParam from '../../Params/HelpTextParam/HelpTextParam'
import SelectMyTestParam from '../../Params/SelectMyTestParam/SelectMyTestParam'
import styles from './NodeParamField.module.scss'
import {useTranslations} from 'next-intl'

function StringParam({
  param,
  value,
  updateNodeParamValue,
  disabled,
  t
}: {
  param: BlockRoadParam
  value: string
  updateNodeParamValue: (v: string) => void
  disabled?: boolean
  t: (v: string) => void
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{param.name}</label>
      <input
        className={styles.stringInput}
        value={value ?? ''}
        disabled={disabled}
        placeholder={t(param.helpText || '') ?? ''}
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
  disabled,
  t
}: {
  param: BlockRoadParam
  value: string
  updateNodeParamValue: (v: string) => void
  disabled?: boolean
  t: (v: string) => void
}) {
  const options: {label: string; value: string}[] = param.options ?? []
  return (
    <div className={styles.field}>
      <label className={styles.label}>{`${t(param.name)}`}</label>
      <select
        className={styles.select}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => updateNodeParamValue(e.target.value)}
      >
        <option value=''>{t(param.helpText || '') ?? 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.label || '') ?? ''}
          </option>
        ))}
      </select>
    </div>
  )
}

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
  const t = useTranslations('roadMap')
  const node = getNode(nodeId) as RoadNode
  const value = useStore((s) => (s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.inputs?.[param.name] ?? '')
  const onlyView = useViewMode() === 'view'
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
      return (
        <StringParam
          t={t}
          param={param}
          value={value}
          updateNodeParamValue={updateNodeParamValue}
          disabled={disabled}
        />
      )
    case RoadMapParamType.SELECT:
      return (
        <SelectParam
          t={t}
          param={param}
          value={value}
          updateNodeParamValue={updateNodeParamValue}
          disabled={disabled}
        />
      )
    case RoadMapParamType.STRING:
      return (
        <HelpTextParam
          t={t}
          param={param}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value={onlyView ? (node.data?.[RoadMapBlockType.INFO_TEXT] as any) || '' : value}
          updateNodeParamValue={updateNodeParamValue}
          disabled={onlyView || disabled}
        />
      )
    case RoadMapParamType.HIDE:
      return <></>
    case RoadMapParamType.CREATE_ACTIVE_TEST:
      return <ActiveTestParam t={t} nodeId={nodeId} onlyPass={onlyView} />
    case RoadMapParamType.SELECT_MY_TEST:
      return (
        <>
          <SelectMyTestParam
            t={t}
            param={param}
            value={value}
            updateNodeParamValue={updateNodeParamValue}
            disabled={disabled}
          />
        </>
      )
    default:
      return <p className={styles.notImplemented}>Not implemented: {param.type}</p>
  }
}
