'use client'
import {PostTestLinkPayload} from '@/shared/types/Post/Post.type'
import styles from './PostBlockEditors.module.scss'

interface Props {
  blockId: string
  payload: PostTestLinkPayload
}

export function PostTestLinkBlockEditor({blockId, payload}: Props) {
  // Заглушка — в будущем здесь будет селект теста
  return (
    <div className={styles.test_link_stub}>
      <span className={styles.stub_icon}>🔗</span>
      <p className={styles.stub_text}>
        Привязка теста — скоро появится.
        <br />
        <span className={styles.stub_sub}>Здесь будет выбор теста из вашей библиотеки.</span>
      </p>
    </div>
  )
}
