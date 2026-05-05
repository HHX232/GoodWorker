import CommentService from '@/features/services/CommentService.service'
import { useQuery } from '@tanstack/react-query'

export function useMyComment(postId: string) {
  return useQuery({
    queryKey: ['myComment', postId],
    queryFn: () => CommentService.getMyComment(postId),
    staleTime: 60_000,
    retry: false,
  })
}
