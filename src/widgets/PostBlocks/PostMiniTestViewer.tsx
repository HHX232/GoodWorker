'use client'

import TestService from '@/features/services/TestService.service'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {TestPlayer} from '@/_pages/TestPages/TestPlayer/TestPlayer'
import {TestResult} from '@/features/Tasks/TaskResult/scoreBlock'
import {PostMiniTestPayload} from '@/shared/types/Post/Post.type'
import {useQuery} from '@tanstack/react-query'
import {ClipboardCheckIcon} from 'lucide-react'
import instance from '@/shared/api'
import styles from './PostMiniTestViewer.module.scss'

interface Props {
  payload: PostMiniTestPayload
  postId: string
}

export function PostMiniTestViewer({payload, postId}: Props) {
  const {testId, title} = payload

  const {data: test, isLoading} = useQuery({
    queryKey: ['test', testId],
    queryFn: () => TestService.getById(testId!),
    enabled: !!testId,
    staleTime: 1000 * 60 * 10
  })

  if (!testId) return null

  const handleResult = async (result: TestResult) => {
    try {
      await instance.post('/post-test-attempt', {
        postId,
        testId,
        score: result.totalScore,
        maxScore: result.maxScore,
        percent: result.percent
      })
    } catch {
      // silent — attempt save is best-effort
    }
  }

  const blocks = (test?.content?.blocks ?? []) as TestBlock[]

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <ClipboardCheckIcon size={15} />
        <span className={styles.label}>Мини-тест</span>
        <span className={styles.title}>{title ?? test?.title ?? ''}</span>
      </div>
      {isLoading ? (
        <p className={styles.hint}>Загрузка теста...</p>
      ) : blocks.length === 0 ? (
        <p className={styles.hint}>Тест не содержит вопросов</p>
      ) : (
        <TestPlayer blocks={blocks} singleBlock showInlineResult onResult={handleResult} />
      )}
    </div>
  )
}
