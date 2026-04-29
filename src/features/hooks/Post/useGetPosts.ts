import PostService, {IPostsQuery} from '@/features/services/PostService.service'
import {useQuery} from '@tanstack/react-query'

export const useGetPosts = (query: IPostsQuery = {}) => {
  return useQuery({
    queryKey: ['posts', query],
    queryFn: () => PostService.getList(query),
    staleTime: 1000 * 30
  })
}
