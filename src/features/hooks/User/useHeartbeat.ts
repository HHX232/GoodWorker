import {useEffect} from 'react'
import {useMe} from './useMe'
import instance from '@/shared/api'

const INTERVAL = 30_000

export function useHeartbeat() {
  const {data: user} = useMe()

  useEffect(() => {
    if (!user) return

    const send = () => instance('/me/heartbeat', {method: 'POST'})
    send()

    const id = setInterval(send, INTERVAL)
    return () => clearInterval(id)
  }, [user?.id])
}
