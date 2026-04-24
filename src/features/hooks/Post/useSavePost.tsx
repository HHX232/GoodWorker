'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import PostService from '@/features/services/PostService.service'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

export type SavePostStatus = 'idle' | 'loading' | 'success' | 'error'

export function useSavePost(existingId?: string) {
  const router = useRouter()
  const [status, setStatus] = useState<SavePostStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const {title, visibility, categoryIds, blocks} = useTypedSelector((state) => state.postSlice)
  const {resetPostConstructor} = useActions()

  const save = async () => {
    if (!title.trim()) {
      setError('Введите заголовок поста')
      return
    }
    if (blocks.length === 0) {
      setError('Добавьте хотя бы один блок')
      return
    }

    setStatus('loading')
    setError(null)

    try {
      const dto = {
        title,
        visibility,
        categoryIds,
        content: {blocks}
      }

      if (existingId) {
        await PostService.update(existingId, dto)
      } else {
        await PostService.create(dto)
      }

      setStatus('success')
      resetPostConstructor()
      router.push('/teacher/posts')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    }
  }

  return {save, status, error}
}
