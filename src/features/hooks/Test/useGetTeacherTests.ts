import TestService from '@/features/services/TestService.service'
import { useQuery } from '@tanstack/react-query'

export const useGetTeacherTests = (teacherId: string | undefined) => {
  return useQuery({
    queryKey: ['tests', 'teacher', teacherId],
    queryFn: () => TestService.getByTeacher(teacherId!),
    staleTime: 1000 * 60 * 5,
    enabled: !!teacherId,
  })
}
