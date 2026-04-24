'use client'

import {PostBlock} from '@/entities/store/slices/post.slice'
import {useActions} from '@/features/hooks/store/useActions'
import {
  PostAudioPayload,
  PostBlockType,
  PostMediaPayload,
  PostTestLinkPayload,
  PostTextPayload
} from '@/shared/types/Post/Post.type'
import {PostAudioBlockEditor} from './PostAudioBlockEditor'
import styles from './PostBlockEditor.module.scss'
import {PostMediaBlockEditor} from './PostMediaBlockEditor'
import {PostTestLinkBlockEditor} from './PostTestLinkBlockEditor'
import {PostTextBlockEditor} from './PostTextBlockEditor'

interface Props {
  block: PostBlock
}

const BLOCK_LABELS: Record<PostBlockType, string> = {
  [PostBlockType.TEXT]: '📝 Текст',
  [PostBlockType.MEDIA]: '🖼 Медиа',
  [PostBlockType.AUDIO]: '🎵 Аудио',
  [PostBlockType.TEST_LINK]: '🔗 Тест'
}

export function PostBlockEditor({block}: Props) {
  const {removePostBlock} = useActions()
  const label = BLOCK_LABELS[block.type]

  const inner = () => {
    switch (block.type) {
      case PostBlockType.TEXT:
        return <PostTextBlockEditor blockId={block.id} payload={block.payload as PostTextPayload} />
      case PostBlockType.MEDIA:
        return <PostMediaBlockEditor blockId={block.id} payload={block.payload as PostMediaPayload} />
      case PostBlockType.AUDIO:
        return <PostAudioBlockEditor blockId={block.id} payload={block.payload as PostAudioPayload} />
      case PostBlockType.TEST_LINK:
        return <PostTestLinkBlockEditor blockId={block.id} payload={block.payload as PostTestLinkPayload} />
      default:
        return null
    }
  }

  return (
    <div className={styles.block_wrap} id={`post-block-${block.id}`}>
      <div className={styles.block_header}>
        <span className={styles.block_label}>{label}</span>
        <button
          type='button'
          className={styles.delete_btn}
          onClick={() => removePostBlock(block.id)}
          aria-label='Удалить блок'
        >
          ✕
        </button>
      </div>
      <div className={styles.block_body}>{inner()}</div>
    </div>
  )
}
