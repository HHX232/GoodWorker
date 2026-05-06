import RoadmapService from '@/features/services/RoadmapService.service'
import { useQuery } from '@tanstack/react-query'

export function useRoadmapAccess(roadmapId: string) {
  return useQuery({
    queryKey: ['roadmapAccess', roadmapId],
    queryFn: () => RoadmapService.checkAccess(roadmapId),
    staleTime: 60_000,
    enabled: !!roadmapId,
  })
}
