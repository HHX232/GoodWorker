'use client'
import { useLayoutEffect } from 'react'

export default function CallLayout({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    // Add class first so CSS display:none on header applies before measurement
    document.documentElement.classList.add('call-page')
    const hEl = document.querySelector('header')
    // getBoundingClientRect() forces reflow — picks up display:none from CSS
    const headerH = hEl ? Math.round(hEl.getBoundingClientRect().height) : 0
    const shell = document.getElementById('call-page-shell')
    if (shell) shell.style.top = headerH + 'px'
    return () => {
      document.documentElement.classList.remove('call-page')
    }
  }, [])
  // CSS for #call-page-shell lives in VideoCallPage.module.scss as :global rule
  return <div id="call-page-shell">{children}</div>
}
