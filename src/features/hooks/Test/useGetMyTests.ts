import TestService from '@/features/services/TestService.service'
import { useQuery } from '@tanstack/react-query'

export const useGetMyTests = (enabled = true) => {
  return useQuery({
    queryKey: ['tests', 'mine'],
    queryFn: () => TestService.getMyTests(),
    staleTime: 1000 * 60,
    enabled,
  })
}
