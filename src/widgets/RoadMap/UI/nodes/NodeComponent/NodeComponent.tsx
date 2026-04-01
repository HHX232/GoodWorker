import RoadMapBlockRegistry from '@/features/Roadmap/registry'
import {RoadMapBlockType, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {Handle, NodeProps, Position} from '@xyflow/react'
import {memo} from 'react'
import ActiveTestBlock from '../../Params/ActiveTestBlock/ActiveTestParam'
import NodeCard from '../NodeCard/NodeCard'
import NodeHeader from '../NodeHeader/NodeHeader'
import NodeInputs, {NodeInput} from '../NodeInputs/NodeInputs'
import DividerOutputs from '../NodeOutputs/DividerOutputs/DividerOutputs'
import NodeOutputs, {NodeOutput} from '../NodeOutputs/NodeOutputs'
import AudioBlock from '../OtherBlocks/AudioBlock/AudioBlock'
import EntryPointBlock from '../OtherBlocks/EntryPointBlock/EntryPointBlock'
import FileBlock from '../OtherBlocks/FileRow/FileRow'
import MediaBlock from '../OtherBlocks/MediaBlock/MediaBlock'
import PostsBlock from '../OtherBlocks/PostsBlockData/PostsBlockData'

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

const NodeComponent = memo((props: NodeProps) => {
  const nodeData = props.data as RoadNodeData
  const task = RoadMapBlockRegistry[nodeData.type]
  const isDivider = nodeData.type === RoadMapBlockType.DIVIDER
  const isAudio = nodeData.type === RoadMapBlockType.INFO_AUDIO
  const isMedia = nodeData.type === RoadMapBlockType.INFO_MEDIA
  const isEntryPoint = nodeData.type === RoadMapBlockType.ENTRY_POINT
  const isPosts = nodeData.type === RoadMapBlockType.POST_LINK
  const isFile = nodeData.type === RoadMapBlockType.DOWNLOAD_FILE_LINK
  const isActiveTest = nodeData.type === RoadMapBlockType.ACTIVE_TEST
  const viewMode = useViewMode()
  const isView = viewMode === 'view'
  return (
    <NodeCard useMini={isDivider} isSelected={!!props.selected} nodeId={props.id}>
      <NodeHeader taskType={nodeData.type} nodeId={props.id} readonly={isView} />
      {isPosts && <PostsBlock nodeId={props.id} readonly={isView} />}
      {isAudio && <AudioBlock nodeId={props.id} readonly={isView} />}
      {isMedia && <MediaBlock nodeId={props.id} readonly={isView} />}
      {isFile && <FileBlock nodeId={props.id} readonly={isView} />}

      {/* В режиме просмотра — onlyPass, в редактировании — редактор */}
      {isActiveTest && <ActiveTestBlock nodeId={props.id} onlyPass={isView} />}

      {isEntryPoint && (
        <>
          <EntryPointBlock nodeId={props.id} readonly={isView} />
          <Handle type='source' position={Position.Right} id={`${props.id}-output`} />
        </>
      )}

      {/* Обычные блоки — скрываем inputs/outputs в режиме просмотра */}
      {!isDivider && !isView && (
        <>
          {task?.inputs && task.inputs.length > 0 && (
            <NodeInputs nodeId={props.id}>
              {task.inputs.map((input) => (
                <NodeInput key={input.name} input={input} nodeId={props.id} />
              ))}
            </NodeInputs>
          )}
          {task?.outputs && task.outputs.length > 0 && (
            <NodeOutputs nodeId={props.id}>
              {task.outputs.map((output) => (
                <NodeOutput key={output.name} output={output} nodeId={props.id} />
              ))}
            </NodeOutputs>
          )}
        </>
      )}

      {isDivider && !isView && (
        <>
          <NodeInputs nodeId={props.id}>
            {task.inputs.map((input) => (
              <NodeInput key={input.name} input={input} nodeId={props.id} />
            ))}
          </NodeInputs>
          <DividerOutputs nodeId={props.id} />
        </>
      )}
    </NodeCard>
  )
})

NodeComponent.displayName = 'NodeComponent'
export default NodeComponent
