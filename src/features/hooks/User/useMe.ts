import MeService, {ICurrentUser} from '@/features/services/me.service'
import {ME_QUERY_KEY} from '@/shared/constants/user/user.const'
import {useQuery} from '@tanstack/react-query'

export function useMe() {
  return useQuery<ICurrentUser, Error>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => MeService.getMe(),
    staleTime: 1000 * 60 * 5,
    retry: false
  })
}
