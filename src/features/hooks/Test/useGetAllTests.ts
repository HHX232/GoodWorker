import TestService from '@/features/services/TestService.service'
import { useQuery } from '@tanstack/react-query'

export const useGetAllTests = (enabled = true) => {
  return useQuery({
    queryKey: ['tests', 'all'],
    queryFn: () => TestService.getAll(),
    staleTime: 1000 * 60,
    enabled,
  })
}
