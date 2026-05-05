import RoadmapService from '@/features/services/RoadmapService.service'
import { useInfiniteQuery } from '@tanstack/react-query'

const LIMIT = 10

export function useRoadmapComments(roadmapId: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ['roadmapComments', roadmapId],
    queryFn: ({ pageParam }) =>
      RoadmapService.getComments(roadmapId, pageParam as number, LIMIT),
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
