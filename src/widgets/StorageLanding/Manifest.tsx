'use client'

import { useTranslations } from 'next-intl'
import { Fragment, useEffect, useRef, useState } from 'react'
import { cx, reduced } from './motion'
import s from './StorageLanding.module.scss'

/** Манифест: слова зажигаются по мере прокрутки (без reduced-motion — просто чёрный текст). */
export function Manifest() {
   const t = useTranslations('StorageLanding')
   const a = t('mf_a').split(/\s+/).filter(Boolean)
   const b = t('mf_b').split(/\s+/).filter(Boolean)
   const total = a.length + b.length
   const ref = useRef<HTMLParagraphElement>(null)
   const [armed, setArmed] = useState(false)
   const [lit, setLit] = useState(0)

   useEffect(() => {
      const el = ref.current
      if (!el || reduced()) return
      const update = () => {
         const r = el.getBoundingClientRect()
         const vh = window.innerHeight
         const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)))
         setLit(Math.round(p * total))
      }
      let tick = false
      const onScroll = () => {
         if (tick) return
         tick = true
         requestAnimationFrame(() => {
            tick = false
            update()
         })
      }
      setArmed(true)
      update()
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', update)
      return () => {
         window.removeEventListener('scroll', onScroll)
         window.removeEventListener('resize', update)
      }
   }, [total])

   const words = (list: string[], offset: number) =>
      list.map((w, i) => (
         <Fragment key={i}>
            <span className={cx(s.w, offset + i < lit && s.on)}>{w}</span>
            {i < list.length - 1 && ' '}
         </Fragment>
      ))

   return (
      <section className={s.mf} aria-label={t('mf_aria')}>
         <div className={s.wrap}>
            <p ref={ref} className={cx(s.mfT, armed && s.mfArmed)}>
               {words(a, 0)} <em>{words(b, a.length)}</em>
            </p>
         </div>
      </section>
   )
}
