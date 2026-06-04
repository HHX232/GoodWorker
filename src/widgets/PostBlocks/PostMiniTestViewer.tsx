'use client'

import {TestPlayer} from '@/_pages/TestPages/TestPlayer/TestPlayer'
import {TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import instance from '@/shared/api'
import {PostMiniTestPayload} from '@/shared/types/Post/Post.type'
import {ClipboardCheckIcon} from 'lucide-react'
import styles from './PostMiniTestViewer.module.scss'

interface Props {
  payload: PostMiniTestPayload
  postId: string
}

export function PostMiniTestViewer({payload, postId}: Props) {
  const {blocks, title} = payload

  if (!blocks || blocks.length === 0) return null

  const handleResult = async (result: TestResult) => {
    try {
      await instance.post('/post-test-attempt', {
        postId,
        score: result.totalScore,
        maxScore: result.maxScore,
        percent: result.percent
      })
    } catch {}
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <ClipboardCheckIcon size={15} />
        <span className={styles.label}>Мини-тест</span>
        {title && <span className={styles.title}>{title}</span>}
      </div>
      <TestPlayer blocks={blocks} singleBlock showInlineResult onResult={handleResult} />
    </div>
  )
}
