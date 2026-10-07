import { useSyncExternalStore, type CSSProperties } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** prefers-reduced-motion в момент вызова (безопасно на сервере). */
export function reduced(): boolean {
   return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

/** Реактивная версия `reduced()`; на сервере — false. */
export function useReducedMotion(): boolean {
   return useSyncExternalStore(
      cb => {
         const mq = window.matchMedia(QUERY)
         mq.addEventListener('change', cb)
         return () => mq.removeEventListener('change', cb)
      },
      reduced,
      () => false
   )
}

/** Web Animations: при reduced-motion — no-op. Возвращает Animation, чтобы её можно было отменить. */
export function animate(el: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
   if (!el || reduced() || !el.animate) return null
   return el.animate(keyframes, options)
}

export type CssVars = CSSProperties & Record<`--${string}`, string | number>

export function cx(...c: Array<string | false | null | undefined>): string {
   return c.filter(Boolean).join(' ')
}
