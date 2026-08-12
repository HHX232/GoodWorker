'use client'

import {PostBlock} from '@/entities/store/slices/post.slice'
import {InfoAudioEditor} from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import {InfoFileListEditor} from '@/features/BlockEditors/InfoFileListEditor/InfoFileListEditor'
import {InfoMediaEditor} from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import {InfoTextEditor} from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import {useActions} from '@/features/hooks/store/useActions'
import {
  PostAudioPayload,
  PostBlockType,
  PostFileListPayload,
  PostMediaPayload,
  PostMiniTestPayload,
  PostPostLinkPayload,
  PostRoadMapLinkPayload,
  PostTestLinkPayload,
  PostTextPayload
} from '@/shared/types/Post/Post.type'
import {Trash2Icon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {toast} from 'sonner'
import styles from './PostBlockEditor.module.scss'
import {PostMiniTestBlockEditor} from './PostMiniTestBlockEditor'
import {PostPostLinkBlockEditor} from './PostPostLinkBlockEditor'
import {PostRoadMapLinkBlockEditor} from './PostRoadMapLinkBlockEditor'
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
    [PostBlockType.MINI_TEST]: t('miniTestLabel'),
    [PostBlockType.POST_LINK]: t('POST_LINKLabel'),
    [PostBlockType.ROAD_MAP_LINK]: t('ROAD_MAP_LINKLabel'),
    [PostBlockType.FILE_LIST]: t('FILE_LISTLabel')
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
      case PostBlockType.POST_LINK:
        return <PostPostLinkBlockEditor blockId={block.id} payload={block.payload as PostPostLinkPayload} />
      case PostBlockType.ROAD_MAP_LINK:
        return <PostRoadMapLinkBlockEditor blockId={block.id} payload={block.payload as PostRoadMapLinkPayload} />
      case PostBlockType.FILE_LIST:
        return (
          <InfoFileListEditor
            payload={block.payload as PostFileListPayload}
            onChange={(p) => updatePostBlockPayload({id: block.id, payload: p})}
          />
        )
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
