'use client'

import {Toaster} from 'sonner'
import {useThemeCtx} from './ThemeContext'

export function ThemedToaster() {
  const {isDark} = useThemeCtx()
  return (
    <Toaster
      style={{zIndex: 1410000010}}
      position="top-right"
      richColors
      theme={isDark ? 'dark' : 'light'}
    />
  )
}
