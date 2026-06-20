'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const COOKIE = 'site-theme'
export const DARK_CLASS = 'theme-dark'

interface Ctx { isDark: boolean; toggleTheme: () => void }
const ThemeCtx = createContext<Ctx>({ isDark: false, toggleTheme: () => {} })

export function useThemeCtx() { return useContext(ThemeCtx) }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const dark = document.cookie.split(';').some(c => c.trim() === `${COOKIE}=dark`)
    setIsDark(dark)
    document.documentElement.classList.toggle(DARK_CLASS, dark)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `${COOKIE}=${next ? 'dark' : 'light'};path=/;max-age=${maxAge};SameSite=Lax`
    document.documentElement.classList.toggle(DARK_CLASS, next)
  }

  return <ThemeCtx.Provider value={{ isDark, toggleTheme }}>{children}</ThemeCtx.Provider>
}
