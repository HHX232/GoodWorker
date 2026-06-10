/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { InfoAudioEditor } from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import { InfoMediaEditor } from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import { InfoTextEditor } from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import { PostBlock, PostBlockType, PostMiniTestPayload } from '@/shared/types/Post/Post.type'
import { PostMiniTestViewer } from '@/widgets/PostBlocks/PostMiniTestViewer'

interface Props {
  blocks: PostBlock[]
  postId: string
  titleNode?: React.ReactNode
}

export const PostBlockRenderer = ({blocks, postId, titleNode}: Props) => {
  // Find index of the first TEXT block to inject the title into it
  const firstTextIdx = titleNode !== undefined
    ? blocks.findIndex((b) => b.type === PostBlockType.TEXT)
    : -1

  return (
    <div
      data-source-type="post"
      data-source-id={postId}
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {blocks.map((block, i) => {
        switch (block.type) {
          case PostBlockType.TEXT:
            return (
              <InfoTextEditor
                key={block.id}
                payload={block.payload as any}
                viewOnly
                titleNode={i === firstTextIdx ? titleNode : undefined}
              />
            )
          case PostBlockType.MEDIA:
            return <InfoMediaEditor key={block.id} payload={block.payload as any} viewOnly />
          case PostBlockType.AUDIO:
            return <InfoAudioEditor key={block.id} payload={block.payload as any} viewOnly />
          case PostBlockType.TEST_LINK:
            return null
          case PostBlockType.MINI_TEST:
            return (
              <PostMiniTestViewer
                key={block.id}
                payload={block.payload as PostMiniTestPayload}
                postId={postId}
                blockId={block.id}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
