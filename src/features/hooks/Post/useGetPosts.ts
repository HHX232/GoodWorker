import PostService, {IPostsQuery} from '@/features/services/PostService.service'
import {useQuery} from '@tanstack/react-query'
import {useLocale} from 'next-intl'
import {useEffect} from 'react'
import {toast} from 'sonner'

const TOAST_ID = 'catalog-posts-error'

export const useGetPosts = (query: IPostsQuery = {}) => {
  const locale = useLocale()
  const result = useQuery({
    queryKey: ['posts', query, locale],
    queryFn: () => PostService.getList({...query, lang: locale}),
    staleTime: 1000 * 30
  })

  useEffect(() => {
    if (result.isError) {
      toast.error('Не удалось загрузить посты. Повторная попытка...', {id: TOAST_ID, duration: 6000})
    }
    if (result.isSuccess) {
      toast.dismiss(TOAST_ID)
    }
  }, [result.isError, result.isSuccess])

  return result
}
