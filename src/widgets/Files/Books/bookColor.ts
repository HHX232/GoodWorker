// Colour helpers for the book kit: a spine colour (#RRGGBB) → readable ink + the tint/deep stops of the typographic cover.
import { SPINE_COLORS } from '@/shared/lib/tutorFiles/bookModel'
import type { CSSProperties } from 'react'

export const SPINE_PRESETS = SPINE_COLORS

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function toHex(c: number[]): string {
  return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

/** Linear blend of two #RRGGBB colours, t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a)
  const B = rgb(b)
  return toHex(A.map((v, i) => v + (B[i] - v) * t))
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Dark ink on a light colour, white on a dark one. */
export function inkOn(hex: string): string {
  return luminance(hex) > 0.4 ? '#141416' : '#ffffff'
}

/** Anything that is not #RRGGBB never reaches a CSS variable. */
export function safeSpine(c: string | null | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(c ?? '') ? (c as string) : SPINE_PRESETS[0]
}

/** The CSS variables BookCover.module.scss reads. */
export function spineVars(spineColor: string): CSSProperties {
  const c = safeSpine(spineColor)
  return {
    '--spine': c,
    '--spine-ink': inkOn(c),
    '--tint': mix(c, '#ffffff', 0.14),
    '--deep': mix(c, '#000000', 0.28),
  } as CSSProperties
}
