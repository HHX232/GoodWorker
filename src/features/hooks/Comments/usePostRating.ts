import CommentService from '@/features/services/CommentService.service'
import { useQuery } from '@tanstack/react-query'

export function usePostRating(postId: string) {
  return useQuery({
    queryKey: ['rating', postId],
    queryFn: () => CommentService.getRating(postId),
    staleTime: 60_000,
  })
}
