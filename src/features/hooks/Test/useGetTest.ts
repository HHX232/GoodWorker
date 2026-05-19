import TestService from '@/features/services/TestService.service'
import { useQuery } from '@tanstack/react-query'

export const useGetTest = (id: string | undefined) => {
  return useQuery({
    queryKey: ['test', id],
    queryFn: () => TestService.getById(id!),
    staleTime: 1000 * 60 * 5,
    enabled: !!id,
  })
}
