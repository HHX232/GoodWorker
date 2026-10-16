import type { FC, ReactElement } from 'react'

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

export const PIECE_CODES: PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

/** One place that turns a skin's drawing function into its 12 piece components. */
export function buildPieces<Ink>(
  name: string,
  white: Ink,
  black: Ink,
  draw: (kind: string, ink: Ink, className?: string) => ReactElement,
): SkinDef['pieces'] {
  return Object.fromEntries(
    PIECE_CODES.map((code) => {
      const ink = code[0] === 'w' ? white : black
      const Piece: FC<{ className?: string }> = ({ className }) => draw(code[1], ink, className)
      Piece.displayName = `${name}${code}`
      return [code, Piece]
    }),
  ) as SkinDef['pieces']
}
