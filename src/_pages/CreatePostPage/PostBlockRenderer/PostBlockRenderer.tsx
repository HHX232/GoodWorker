/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { InfoAudioEditor } from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import { InfoMediaEditor } from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import { InfoTextEditor } from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import { PostBlock, PostBlockType } from '@/shared/types/Post/Post.type'

interface Props {
  blocks: PostBlock[]
  postId: string
}

export const PostBlockRenderer = ({blocks, postId}: Props) => {
  console.log('blocks', blocks)
  return (
    <div
      data-source-type="post"
      data-source-id={postId}
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {blocks.map((block) => {
        switch (block.type) {
          case PostBlockType.TEXT:
            return <InfoTextEditor key={block.id} payload={block.payload as any} viewOnly />
          case PostBlockType.MEDIA:
            return <InfoMediaEditor key={block.id} payload={block.payload as any} viewOnly />
          case PostBlockType.AUDIO:
            return <InfoAudioEditor key={block.id} payload={block.payload as any} viewOnly />
          case PostBlockType.TEST_LINK:
            // TODO: компонент для ссылки на тест
            return null
          default:
            return null
        }
      })}
    </div>
  )
}
