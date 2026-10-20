'use client'
import { useEffect, useRef } from 'react'

/** A scroll box in chronological DOM order that follows its newest content (coach lines) via scrollTop. */
export function useStickToEnd<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const toEnd = () => (el.scrollTop = el.scrollHeight)
    const mo = new MutationObserver(toEnd)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    toEnd()
    return () => mo.disconnect()
  }, [])
  return ref
}
