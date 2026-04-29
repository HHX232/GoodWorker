import useSWR from 'swr'

interface OnlineStatus {
  online: boolean
  lastSeenAt: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useOnlineStatus(userId: string | undefined) {
  const {data} = useSWR<OnlineStatus>(userId ? `/api/user/${userId}/online` : null, fetcher, {refreshInterval: 30_000})

  return {
    online: data?.online ?? false,
    lastSeenAt: data?.lastSeenAt ? new Date(data.lastSeenAt) : null
  }
}
