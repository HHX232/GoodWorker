'use client'

import {postActions} from '@/entities/store/slices/post.slice'
import {PostAudioPayload} from '@/shared/types/Post/Post.type'
import {useDispatch} from 'react-redux'
import styles from './PostBlockEditors.module.scss'

interface Props {
  blockId: string
  payload: PostAudioPayload
}

export function PostAudioBlockEditor({blockId, payload}: Props) {
  const dispatch = useDispatch()

  const update = (patch: Partial<PostAudioPayload>) =>
    dispatch(
      postActions.updatePostBlockPayload({
        id: blockId,
        payload: {...payload, ...patch}
      })
    )

  return (
    <div className={styles.audio_editor}>
      <input
        className={styles.url_input}
        type='url'
        placeholder='Вставьте ссылку на аудиофайл…'
        value={payload.url ?? ''}
        onChange={(e) => update({url: e.target.value, filename: e.target.value.split('/').pop() ?? null})}
      />
      {payload.url && <audio controls src={payload.url} className={styles.audio_player} />}
    </div>
  )
}
