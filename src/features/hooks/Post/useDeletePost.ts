import PostService from '@/features/services/PostService.service'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useRouter} from 'next/navigation'

export const useDeletePost = (id: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: () => PostService.delete(id),
    onSuccess: () => {
      queryClient.removeQueries({queryKey: ['post', id]})
      router.push('/teacher/posts')
    }
  })
}
