import RoadmapService from '@/features/services/RoadmapService.service'
import { useQuery } from '@tanstack/react-query'

export function useMyRoadmapComment(roadmapId: string) {
  return useQuery({
    queryKey: ['myRoadmapComment', roadmapId],
    queryFn: () => RoadmapService.getMyComment(roadmapId),
    staleTime: 60_000,
    retry: false,
  })
}
