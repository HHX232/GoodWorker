import RoadMapBlockRegistry from '@/features/Roadmap/registry'
import {RoadMapBlockType, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useRoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {NodeProps} from '@xyflow/react'
import {memo} from 'react'
import NodeCard from '../NodeCard/NodeCard'
import NodeHeader from '../NodeHeader/NodeHeader'
import NodeInputs, {NodeInput} from '../NodeInputs/NodeInputs'
import DividerOutputs from '../NodeOutputs/DividerOutputs/DividerOutputs'
import NodeOutputs, {NodeOutput} from '../NodeOutputs/NodeOutputs'
import {PaywallOverlay} from '../PaywallOverlay/PaywallOverlay'
import {useNodeContent} from '../hooks/useNodeContent'

const NodeComponent = memo((props: NodeProps) => {
  const nodeData = props.data as RoadNodeData
  const task = RoadMapBlockRegistry[nodeData.type]
  const viewMode = useViewMode()
  const {hasAccess, nodeAccessType, roadmapPrice} = useRoadmapAccessContext()
  const isView = viewMode === 'view'
  const isLockedInView = isView && !hasAccess && (nodeAccessType !== null || roadmapPrice > 0)
  const isDivider = nodeData.type === RoadMapBlockType.DIVIDER
  const isEntryPoint = nodeData.type === RoadMapBlockType.ENTRY_POINT
  const blockContent = useNodeContent({nodeId: props.id, nodeData})

  return (
    <NodeCard useMini={isDivider} isSelected={!!props.selected} nodeId={props.id}>
      <NodeHeader taskType={nodeData.type} nodeId={props.id} />

      {isLockedInView ? (
        <PaywallOverlay
          type={nodeData.type}
          nodeId={props.id}
          hasInput={!isEntryPoint && !isDivider}
          hasOutput={!isDivider}
          inputs={task?.inputs}
          outputs={task?.outputs}
        />
      ) : (
        <>
          {blockContent}

          {!isDivider && (
            <>
              {!isEntryPoint && (
                <NodeInputs nodeId={props.id} hidden={isView}>
                  {task?.inputs?.map((input) => (
                    <NodeInput key={input.name} input={input} nodeId={props.id} />
                  ))}
                </NodeInputs>
              )}
              <NodeOutputs nodeId={props.id} hidden={isView}>
                {task?.outputs?.map((output) => (
                  <NodeOutput key={output.name} output={output} nodeId={props.id} />
                ))}
              </NodeOutputs>
            </>
          )}

          {isDivider && (
            <>
              <NodeInputs nodeId={props.id} hidden={isView}>
                {task.inputs.map((input) => (
                  <NodeInput key={input.name} input={input} nodeId={props.id} />
                ))}
              </NodeInputs>
              <DividerOutputs nodeId={props.id} />
            </>
          )}
        </>
      )}
    </NodeCard>
  )
})

NodeComponent.displayName = 'NodeComponent'
export default NodeComponent
