import instance from '@/shared/api'
import {ME_QUERY_KEY} from '@/shared/constants/user/user.const'
import {useMutation, useQueryClient} from '@tanstack/react-query'

interface UpdateProfileDto {
  name?: string
  phone?: string | null
  avatarUrl?: string | null
}

const updateProfile = async (userType: 'Student' | 'Teacher', dto: UpdateProfileDto) => {
  const url = userType === 'Student' ? '/profile/edit/student' : '/profile/edit/teacher'
  const response = await instance.patch(url, dto)
  return response.data
}

export function useUpdateProfile(userType: 'Student' | 'Teacher') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: UpdateProfileDto) => updateProfile(userType, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ME_QUERY_KEY})
    }
  })
}
