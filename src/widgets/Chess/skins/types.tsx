import { cloneElement, type FC, type ReactElement, type SVGProps } from 'react'

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

// Readability on any board: under each piece the same shapes are drawn once more as a solid silhouette,
// a hairline wider, in the opposite tone (dark rim for white pieces, light rim for black). Plain SVG strokes —
// nothing to recompute while a piece slides.
const HALO = { w: 'rgba(24, 18, 14, 0.6)', b: 'rgba(255, 248, 236, 0.62)' }
const HALO_EXTRA = 3

/** One place that turns a skin's drawing (a single `<g>` with its fill/stroke) into its 12 piece components. */
export function buildPieces<Ink>(
  name: string,
  white: Ink,
  black: Ink,
  draw: (kind: string, ink: Ink, side: 'w' | 'b') => ReactElement<SVGProps<SVGGElement>>,
): SkinDef['pieces'] {
  return Object.fromEntries(
    PIECE_CODES.map((code) => {
      const side = code[0] as 'w' | 'b'
      const Piece: FC<{ className?: string }> = ({ className }) => {
        const g = draw(code[1], side === 'w' ? white : black, side)
        const halo = HALO[side]
        return (
          <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
            {cloneElement(g, { fill: halo, stroke: halo, strokeWidth: (Number(g.props.strokeWidth) || 0) + HALO_EXTRA })}
            {g}
          </svg>
        )
      }
      Piece.displayName = `${name}${code}`
      return [code, Piece]
    }),
  ) as SkinDef['pieces']
}
