import RoadmapService from '@/features/services/RoadmapService.service'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

const LIMIT = 10

export function useRoadmapComments(roadmapId: string, enabled = true) {
  const locale = useLocale()
  const query = useInfiniteQuery({
    queryKey: ['roadmapComments', roadmapId, locale],
    queryFn: ({ pageParam }) =>
      RoadmapService.getComments(roadmapId, pageParam as number, LIMIT, locale),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const { page, totalPages } = last.pagination
      return page < totalPages ? page + 1 : undefined
    },
    enabled,
    staleTime: 30_000,
  })

  const comments = query.data?.pages.flatMap((p) => p.comments) ?? []

  return { ...query, comments }
}
