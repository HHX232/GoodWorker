import PostService, {IPostsQuery} from '@/features/services/PostService.service'
import {useQuery} from '@tanstack/react-query'
import {useLocale} from 'next-intl'

export const useGetPosts = (query: IPostsQuery = {}) => {
  const locale = useLocale()
  return useQuery({
    queryKey: ['posts', query, locale],
    queryFn: () => PostService.getList({...query, lang: locale}),
    staleTime: 1000 * 30
  })
}
