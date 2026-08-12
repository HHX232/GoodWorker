'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import styles from './NavProgress.module.scss'

export function NavProgress() {
  const pathname = usePathname()
  const prevPath = useRef(pathname)
  const active   = useRef(false)
  const timer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)

  function startBar() {
    clearTimeout(timer.current)
    active.current = true
    setDone(false)
    setShow(true)
  }

  function completeBar() {
    if (!active.current) return
    active.current = false
    setDone(true)
    timer.current = setTimeout(() => {
      setShow(false)
      setDone(false)
    }, 500)
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (!href || /^(https?:|\/\/|#|mailto:|tel:)/.test(href)) return
      if (a.target === '_blank') return
      startBar()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // runs after every render — lightweight pathname check
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      completeBar()
    }
  })

  if (!show) return null

  return (
    <span
      aria-hidden
      className={`${styles.bar}${done ? ` ${styles.done}` : ''}`}
      style={done ? { width: '100%' } : undefined}
    />
  )
}
