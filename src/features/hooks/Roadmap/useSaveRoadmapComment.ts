import RoadmapService from '@/features/services/RoadmapService.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface SaveRoadmapCommentDto {
  text: string
  imageUrls: string[]
}

export function useSaveRoadmapComment(roadmapId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: SaveRoadmapCommentDto) =>
      RoadmapService.createOrUpdateComment(roadmapId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmapComments', roadmapId] })
      queryClient.invalidateQueries({ queryKey: ['myRoadmapComment', roadmapId] })
    },
  })
}
