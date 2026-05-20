import MeService, {ICurrentUser} from '@/features/services/me.service'
import {ME_QUERY_KEY} from '@/shared/constants/user/user.const'
import {useQuery} from '@tanstack/react-query'
import {useSession} from 'next-auth/react'
import {AxiosError} from 'axios'

export function useMe() {
  const {data: session} = useSession()

  return useQuery<ICurrentUser, AxiosError>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => MeService.getMe(),
    staleTime: 1000 * 60 * 5,
    enabled: !!session?.user,
    retry: (failureCount, error) => {
      const status = error.response?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
  })
}
