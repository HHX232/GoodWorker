'use client'

import {postActions} from '@/entities/store/slices/post.slice'
import {PostMediaPayload, PostMediaKind} from '@/shared/types/Post/Post.type'
import {useDispatch} from 'react-redux'
import styles from './PostBlockEditors.module.scss'

interface Props {
  blockId: string
  payload: PostMediaPayload
}

export function PostMediaBlockEditor({blockId, payload}: Props) {
  const dispatch = useDispatch()

  const update = (patch: Partial<PostMediaPayload>) =>
    dispatch(
      postActions.updatePostBlockPayload({
        id: blockId,
        payload: {...payload, ...patch}
      })
    )

  return (
    <div className={styles.media_editor}>
      <div className={styles.kind_toggle}>
        {(['image', 'video'] as PostMediaKind[]).map((k) => (
          <button
            key={k}
            type='button'
            className={`${styles.kind_btn} ${payload.kind === k ? styles.active : ''}`}
            onClick={() => update({kind: k})}
          >
            {k === 'image' ? '🖼 Изображение' : '🎬 Видео'}
          </button>
        ))}
      </div>

      {payload.kind && (
        <>
          <input
            className={styles.url_input}
            type='url'
            placeholder={`Вставьте ссылку на ${payload.kind === 'image' ? 'изображение' : 'видео'}…`}
            value={payload.url ?? ''}
            onChange={(e) => update({url: e.target.value})}
          />
          {payload.url && payload.kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.url} alt='preview' className={styles.preview_img} />
          )}
          {payload.url && payload.kind === 'video' && (
            <video src={payload.url} controls className={styles.preview_video} />
          )}
          <input
            className={styles.url_input}
            type='text'
            placeholder='Подпись (необязательно)…'
            value={payload.caption ?? ''}
            onChange={(e) => update({caption: e.target.value})}
          />
        </>
      )}
    </div>
  )
}
