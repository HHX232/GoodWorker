import type { FC } from 'react'

export type SkinId = 'classic' | 'vintage' | 'night' | 'bordo' | 'powder'

export type PieceCode =
  | 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP'
  | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP'

export type SkinDef = {
  id: SkinId
  /** key in `chess.core` */
  labelKey: string
  light: string
  dark: string
  coordLight: string
  coordDark: string
  frame?: string
  pieces: Record<PieceCode, FC<{ className?: string }>>
}
