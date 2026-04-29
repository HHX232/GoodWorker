import PostService from '@/features/services/PostService.service'
import {useQuery} from '@tanstack/react-query'

export const useGetPost = (id: string | undefined) => {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => PostService.getById(id!),
    enabled: !!id
  })
}
