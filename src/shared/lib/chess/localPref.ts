'use client'
import { useCallback, useSyncExternalStore } from 'react'

// A string preference in localStorage that every hook instance on the page (and other tabs) sees at once.
const EVENT = 'gw-chess-pref'

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function useLocalPref(key: string, fallback: string): [string, (v: string) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      const onPref = (e: Event) => (e as CustomEvent<string>).detail === key && cb()
      const onStorage = (e: StorageEvent) => e.key === key && cb()
      window.addEventListener(EVENT, onPref)
      window.addEventListener('storage', onStorage)
      return () => {
        window.removeEventListener(EVENT, onPref)
        window.removeEventListener('storage', onStorage)
      }
    },
    [key]
  )
  const value = useSyncExternalStore(subscribe, () => readPref(key) ?? fallback, () => fallback)
  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v)
      } catch {}
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
    },
    [key]
  )
  return [value, set]
}

/** One-time split of the old single skin key: board and pieces both take its value (new keys win). */
export function migrateSkinPref(s: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const old = s.getItem('gw-chess-skin')
  if (old == null) return
  for (const k of ['gw-chess-board', 'gw-chess-pieces']) if (s.getItem(k) == null) s.setItem(k, old)
  s.removeItem('gw-chess-skin')
}
