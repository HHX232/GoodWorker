'use client'
import {useEffect} from 'react'

// Module-level counter: body stays locked as long as any consumer holds a lock
let lockCount = 0

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    lockCount++
    if (lockCount === 1) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      lockCount--
      if (lockCount <= 0) {
        lockCount = 0
        document.body.style.overflow = ''
      }
    }
  }, [locked])
}
