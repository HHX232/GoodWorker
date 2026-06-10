'use client'

import {TestPlayer} from '@/_pages/TestPages/TestPlayer/TestPlayer'
import {TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import instance from '@/shared/api'
import {PostMiniTestPayload} from '@/shared/types/Post/Post.type'
import {ClipboardCheckIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import styles from './PostMiniTestViewer.module.scss'

interface Props {
  payload: PostMiniTestPayload
  postId: string
  blockId: string
}

export function PostMiniTestViewer({payload, postId, blockId}: Props) {
  const t = useTranslations('TestPlayer')
  const {blocks, title} = payload

  if (!blocks || blocks.length === 0) return null

  const handleResult = async (result: TestResult) => {
    try {
      await instance.post('/post-test-attempt', {
        postId,
        testId: blockId,
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
        <span className={styles.label}>{t('miniTestLabel')}</span>
        {title && <span className={styles.title}>{title}</span>}
      </div>
      <TestPlayer blocks={blocks} singleBlock showInlineResult onResult={handleResult} />
    </div>
  )
}
