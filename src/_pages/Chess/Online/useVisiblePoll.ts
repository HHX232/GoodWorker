'use client'

import { useEffect, useRef } from 'react'

/** Опрос раз в ms, только пока вкладка видима (как чат); при возврате на вкладку — сразу. */
export function useVisiblePoll(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    if (!enabled) return
    let busy = false
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        await ref.current()
      } finally {
        busy = false
      }
    }
    const id = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ms, enabled])
}
