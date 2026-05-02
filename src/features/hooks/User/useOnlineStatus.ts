import { useQuery } from '@tanstack/react-query'

interface OnlineStatus {
  online: boolean
  lastSeenAt: string | null
}

const fetcher = (url: string): Promise<OnlineStatus> => fetch(url).then((r) => r.json())

export function useOnlineStatus(userId: string | undefined) {
  const { data } = useQuery<OnlineStatus>({
    queryKey: ['user', userId, 'online'],
    queryFn: () => fetcher(`/api/user/${userId}/online`),
    enabled: !!userId,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  return {
    online: data?.online ?? false,
    lastSeenAt: data?.lastSeenAt ? new Date(data.lastSeenAt) : null,
  }
}
