import RoadmapService, { IRoadmapQuery } from '@/features/services/RoadmapService.service'
import { useInfiniteQuery } from '@tanstack/react-query'

const LIMIT = 12

export function useRoadmapPreviews(filters: Omit<IRoadmapQuery, 'page' | 'limit'> = {}) {
  const query = useInfiniteQuery({
    queryKey: ['roadmapPreviews', filters],
    queryFn: ({ pageParam }) =>
      RoadmapService.getList({ ...filters, page: pageParam as number, limit: LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const { page, totalPages } = last.pagination
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 60_000,
  })

  const roadmaps = query.data?.pages.flatMap((p) => p.roadmaps) ?? []
  const total = query.data?.pages[0]?.pagination.total ?? 0

  return { ...query, roadmaps, total }
}
