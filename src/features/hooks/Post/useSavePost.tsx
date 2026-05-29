'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import PostService from '@/features/services/PostService.service'
import {PostBlock} from '@/shared/types/Post/Post.type'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {toast} from 'sonner'

export function useSavePost(existingId?: string) {
  const t = useTranslations('CreatePostPage')
  const router = useRouter()
  const queryClient = useQueryClient()

  const {title, visibility, categoryIds, blocks} = useTypedSelector((state) => state.postSlice)
  const {resetPostConstructor} = useActions()

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
      toast.success(existingId ? t('successUpdated') : t('successPublished'))
    },
    onError: () => {
      toast.error(t('errorSaveFailed'))
    },
  })

  const save = () => {
    if (!title.trim()) { toast.error(t('errorTitleRequired')); return }
    if (blocks.length === 0) { toast.error(t('errorBlocksRequired')); return }
    mutation.mutate()
  }

  return {
    save,
    status: mutation.status === 'pending' ? 'loading' : mutation.status,
  }
}
