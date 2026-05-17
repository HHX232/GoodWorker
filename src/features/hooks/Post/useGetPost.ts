import PostService from '@/features/services/PostService.service'
import {useQuery} from '@tanstack/react-query'
import {useLocale} from 'next-intl'

export const useGetPost = (id: string | undefined) => {
  const locale = useLocale()
  return useQuery({
    queryKey: ['post', id, locale],
    queryFn: () => PostService.getById(id!, locale),
    enabled: !!id
  })
}
