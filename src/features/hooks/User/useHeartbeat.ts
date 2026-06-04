import {useEffect} from 'react'
import {useSession} from 'next-auth/react'

const INTERVAL = 30_000

export function useHeartbeat() {
  const {data: session, status} = useSession()
  const userId = (session?.user as {id?: string})?.id

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return

    const send = () =>
      fetch('/api/me/heartbeat', {method: 'POST'}).catch(() => {})

    send()
    const id = setInterval(send, INTERVAL)
    return () => clearInterval(id)
  }, [status, userId])
}
