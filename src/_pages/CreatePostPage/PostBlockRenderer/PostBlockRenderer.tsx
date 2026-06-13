/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { InfoAudioEditor } from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import { InfoMediaEditor } from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import { InfoTextEditor } from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import { PostBlock, PostBlockType, PostMiniTestPayload, PostTestLinkPayload } from '@/shared/types/Post/Post.type'
import { PostMiniTestViewer } from '@/widgets/PostBlocks/PostMiniTestViewer'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import styles from './PostBlockRenderer.module.scss'

interface Props {
  blocks: PostBlock[]
  postId: string
  titleNode?: React.ReactNode
}

export const PostBlockRenderer = ({blocks, postId, titleNode}: Props) => {
  const t = useTranslations('TestPlayer')
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
          case PostBlockType.TEST_LINK: {
            const p = block.payload as PostTestLinkPayload
            if (!p.testId) return null
            return (
              <div key={block.id} className={styles.testLink}>
                <span className={styles.testLinkTitle}>
                  {p.title || t('testLinkTitle')}
                </span>
                <Link href={`/test/${p.testId}`} className={styles.testLinkBtn}>
                  {t('testLinkBtn')}
                </Link>
              </div>
            )
          }
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
