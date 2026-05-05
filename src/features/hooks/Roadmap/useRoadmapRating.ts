import RoadmapService from '@/features/services/RoadmapService.service'
import { useQuery } from '@tanstack/react-query'

export function useRoadmapRating(roadmapId: string, initialAvgRating?: number) {
  return useQuery({
    queryKey: ['roadmapRating', roadmapId],
    queryFn: () => RoadmapService.getRating(roadmapId),
    staleTime: 60_000,
    placeholderData: initialAvgRating !== undefined
      ? { avgRating: initialAvgRating, totalRatings: 0, userRating: null }
      : undefined,
  })
}
