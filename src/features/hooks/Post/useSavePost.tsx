'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import PostService from '@/features/services/PostService.service'
import {PostBlock} from '@/shared/types/Post/Post.type'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

export function useSavePost(existingId?: string) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const {title, visibility, categoryIds, blocks} = useTypedSelector((state) => state.postSlice)
  const {resetPostConstructor} = useActions()
  const [validationError, setValidationError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const dto = {
        title,
        visibility,
        categoryIds,
        content: {blocks: blocks as PostBlock[]}
      }
      return existingId ? PostService.update(existingId, dto) : PostService.create(dto)
    },
    onSuccess: (data) => {
      if (existingId) {
        queryClient.setQueryData(['post', existingId], data)
      } else {
        queryClient.setQueryData(['post', data.id], data)
      }
      resetPostConstructor()
      router.push(`/post/${data.id || existingId}`)
    }
  })

  const save = () => {
    if (!title.trim()) return setValidationError('Введите заголовок поста')
    if (blocks.length === 0) return setValidationError('Добавьте хотя бы один блок')
    setValidationError(null)
    mutation.mutate()
  }

  return {
    save,
    status: mutation.status === 'pending' ? 'loading' : mutation.status,
    error: validationError ?? (mutation.error instanceof Error ? mutation.error.message : null)
  }
}
