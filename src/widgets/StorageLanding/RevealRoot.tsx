'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { reduced } from './motion'
import s from './StorageLanding.module.scss'

/**
 * Корень страницы + reveal по скроллу: каждому [data-reveal] при первом въезде в экран (порог 0.15)
 * ставится класс isIn и наблюдение снимается. Без IntersectionObserver / при reduced-motion —
 * isIn сразу всем (контент виден). Как и в прототипе, ядро ничего не знает про вид появления —
 * его описывает CSS каждого блока.
 */
export function RevealRoot({ children }: { children: ReactNode }) {
   const ref = useRef<HTMLDivElement>(null)

   useEffect(() => {
      const els = Array.from(ref.current?.querySelectorAll('[data-reveal]') ?? [])
      if (reduced() || !('IntersectionObserver' in window)) {
         els.forEach(el => el.classList.add(s.isIn))
         return
      }
      const io = new IntersectionObserver(
         entries => {
            entries.forEach(e => {
               if (!e.isIntersecting) return
               e.target.classList.add(s.isIn)
               io.unobserve(e.target)
            })
         },
         { threshold: 0.15 }
      )
      els.forEach(el => io.observe(el))
      return () => io.disconnect()
   }, [])

   return (
      <div ref={ref} className={s.root}>
         {children}
      </div>
   )
}
