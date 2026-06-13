/* eslint-disable @typescript-eslint/no-explicit-any */
import { RoadPostLinkTask } from '@/features/Roadmap/tasks/RoadPostLinkTask'
import TestService from '@/features/services/TestService.service'
import { RoadMapBlockType, RoadNodeData } from '@/shared/types/RoadMap/RoadMap.types'
import { useViewMode } from '@/shared/ui/RoadMap/context/ViewModeContext'
import TestPreview from '@/widgets/Tasks/TestPreview/TestPreview'
import { useQuery } from '@tanstack/react-query'
import { Handle, Position } from '@xyflow/react'
import { useTranslations } from 'next-intl'
import { JSX, useMemo } from 'react'
import ActiveTestBlock from '../../Params/ActiveTestBlock/ActiveTestParam'
import AudioBlock from '../OtherBlocks/AudioBlock/AudioBlock'
import EntryPointBlock from '../OtherBlocks/EntryPointBlock/EntryPointBlock'
import FileBlock from '../OtherBlocks/FileRow/FileRow'
import MediaBlock from '../OtherBlocks/MediaBlock/MediaBlock'
import PostsBlock from '../OtherBlocks/PostsBlockData/PostsBlockData'
import ActiveCommentBlock from '../../Params/ActiveCommentBlock/ActiveCommentBlock'

function ViewTestLinkBlock({testId}: {testId: string}) {
  const {data: test, isLoading} = useQuery({
    queryKey: ['test', testId],
    queryFn: () => TestService.getById(testId),
    enabled: !!testId,
  })

  if (isLoading) return <p style={{padding: '.5rem .7rem', fontSize: 13, color: '#888'}}>...</p>
  if (!test) return null

  return (
    <p>
      <TestPreview
        useBorder={false}
        testId={test.id}
        avatarUrl={test.teacher?.avatarUrl ?? ''}
        authorName={test.teacher?.name ?? ''}
        title={test.title}
        description={test.aiTopic ?? ''}
        themes={test.testCategories?.map(tc => tc.category.translations[0]?.name ?? tc.category.slug) ?? []}
        createdAt={test.createdAt}
      />
    </p>
  )
}

interface UseNodeContentProps {
  nodeId: string
  nodeData: RoadNodeData
}

type BlockRenderer = (
  props: UseNodeContentProps & {
    isView: boolean
    t: ReturnType<typeof useTranslations>
  }
) => JSX.Element | null

const BLOCK_RENDERERS: Partial<Record<RoadMapBlockType, BlockRenderer>> = {
  [RoadMapBlockType.POST_LINK]: ({nodeId}) => <PostsBlock nodeId={nodeId} />,

  [RoadMapBlockType.INFO_AUDIO]: ({nodeId}) => <AudioBlock nodeId={nodeId} />,

  [RoadMapBlockType.INFO_MEDIA]: ({nodeId}) => <MediaBlock nodeId={nodeId} />,

  [RoadMapBlockType.DOWNLOAD_FILE_LINK]: ({nodeId}) => <FileBlock nodeId={nodeId} />,
[RoadMapBlockType.ACTIVE_COMMENT]: ({nodeId, nodeData, isView, t}) => (
    <ActiveCommentBlock
      t={t}
      nodeId={nodeId}
      onlyPass={isView}
      headerColor={(nodeData as any).headerColor ?? ''}
    />
  ),
  [RoadMapBlockType.TEST_LINK]: ({nodeData, isView}) => {
    const testId = (nodeData.inputs as any)?.[RoadPostLinkTask.label] as string | undefined
    if (!testId || !isView) return null
    return <ViewTestLinkBlock testId={testId} />
  },

  [RoadMapBlockType.INFO_TEXT]: ({nodeData, isView}) =>
    isView ? (
      <p style={{padding: '.2rem .7rem', maxWidth: '350px'}}>{(nodeData.inputs as any)?.[RoadMapBlockType.INFO_TEXT] ?? ''}</p>
    ) : null,

  [RoadMapBlockType.ACTIVE_TEST]: ({nodeId, isView, t}) => <ActiveTestBlock t={t} nodeId={nodeId} onlyPass={isView} />,

  [RoadMapBlockType.ENTRY_POINT]: ({nodeId}) => (
    <>
      <EntryPointBlock nodeId={nodeId} />
      <Handle type='source' position={Position.Right} id={`${nodeId}-output`} />
    </>
  )
}

export function useNodeContent({nodeId, nodeData}: UseNodeContentProps): JSX.Element | null {
  const viewMode = useViewMode()
  const t = useTranslations('roadMap')
  const isView = viewMode === 'view'

  return useMemo(() => {
    const renderer = BLOCK_RENDERERS[nodeData.type]
    return renderer?.({nodeId, nodeData, isView, t}) ?? null
  }, [nodeId, nodeData, isView, t])
}
