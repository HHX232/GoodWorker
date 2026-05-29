'use client'

import {PostBlock} from '@/entities/store/slices/post.slice'
import {InfoAudioEditor} from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import {InfoMediaEditor} from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import {InfoTextEditor} from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import {useActions} from '@/features/hooks/store/useActions'
import {
  PostAudioPayload,
  PostBlockType,
  PostMediaPayload,
  PostMiniTestPayload,
  PostTestLinkPayload,
  PostTextPayload
} from '@/shared/types/Post/Post.type'
import {Trash2Icon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {toast} from 'sonner'
import styles from './PostBlockEditor.module.scss'
import {PostMiniTestBlockEditor} from './PostMiniTestBlockEditor'
import {PostTestLinkBlockEditor} from './PostTestLinkBlockEditor'

interface Props {
  block: PostBlock
}

export function PostBlockEditor({block}: Props) {
  const t = useTranslations('PostBlockEditor')
  const {removePostBlock, updatePostBlockPayload} = useActions()

  const BLOCK_LABELS: Record<PostBlockType, string> = {
    [PostBlockType.TEXT]: t('textLabel'),
    [PostBlockType.MEDIA]: t('mediaLabel'),
    [PostBlockType.AUDIO]: t('audioLabel'),
    [PostBlockType.TEST_LINK]: t('testLabel'),
    [PostBlockType.MINI_TEST]: t('miniTestLabel')
  }

  const label = BLOCK_LABELS[block.type]

  const handleDelete = () => {
    removePostBlock(block.id)
    toast.error(t('blockDeleted', {label}))
  }

  const inner = () => {
    switch (block.type) {
      case PostBlockType.TEXT:
        return (
          <InfoTextEditor
            payload={block.payload as PostTextPayload}
            onChange={(p) => updatePostBlockPayload({id: block.id, payload: p})}
          />
        )
      case PostBlockType.MEDIA:
        return (
          <InfoMediaEditor
            payload={block.payload as PostMediaPayload}
            onChange={(p) => updatePostBlockPayload({id: block.id, payload: p})}
          />
        )
      case PostBlockType.AUDIO:
        return (
          <InfoAudioEditor
            payload={block.payload as PostAudioPayload}
            onChange={(p) => updatePostBlockPayload({id: block.id, payload: p})}
          />
        )
      case PostBlockType.TEST_LINK:
        return <PostTestLinkBlockEditor blockId={block.id} payload={block.payload as PostTestLinkPayload} />
      case PostBlockType.MINI_TEST:
        return <PostMiniTestBlockEditor blockId={block.id} payload={block.payload as PostMiniTestPayload} />
      default:
        return null
    }
  }

  return (
    <div className={styles.block_wrap} id={`post-block-${block.id}`}>
      <div className={styles.block_header}>
        <span className={styles.block_label}>{label}</span>
        <button type='button' className={styles.delete_btn} onClick={handleDelete} aria-label={t('deleteBlock')}>
          <Trash2Icon size={14} />
        </button>
      </div>
      <div className={styles.block_body}>{inner()}</div>
    </div>
  )
}
