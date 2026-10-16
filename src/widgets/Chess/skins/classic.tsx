import type { FC, ReactNode } from 'react'
import type { PieceCode, SkinDef } from './types'

// Classic: plain Staunton silhouettes, drawn for GoodWorker on a 100×100 grid.
type Ink = { fill: string; line: string; detail: string }
const WHITE: Ink = { fill: '#fbf8f1', line: '#1c1915', detail: '#1c1915' }
const BLACK: Ink = { fill: '#2a2521', line: '#120f0d', detail: '#efe6d6' }

const base = (
  <>
    <path d="M27 76h46l2 6H25z" />
    <rect x="21" y="82" width="58" height="9" rx="3" />
  </>
)

const SHAPES: Record<string, (ink: Ink) => ReactNode> = {
  P: () => (
    <>
      <path d="M41 46c0 12-7 20-11 30h40c-4-10-11-18-11-30z" />
      <ellipse cx="50" cy="45" rx="13" ry="4.5" />
      <circle cx="50" cy="29" r="11.5" />
      {base}
    </>
  ),
  R: () => (
    <>
      <path d="M33 76l3-33h28l3 33z" />
      <path d="M27 20h10v8h7v-8h12v8h7v-8h10v19l-6 5H33l-6-5z" />
      <path d="M33 44h34" fill="none" />
      {base}
    </>
  ),
  B: (ink) => (
    <>
      <path d="M41 50c-1 11-6 18-10 26h38c-4-8-9-15-10-26z" />
      <ellipse cx="50" cy="49" rx="14" ry="4.5" />
      <path d="M50 14c11 9 15 20 11 31H39c-4-11 0-22 11-31z" />
      <circle cx="50" cy="11" r="4.5" />
      <path d="M55 23l-9 11" stroke={ink.detail} fill="none" />
      {base}
    </>
  ),
  N: (ink) => (
    <>
      <path d="M29 76c0-10 4-17 13-24-6 2-12 4-16 2-5-2-7-7-5-11 3-6 9-10 15-16 3-5 6-10 9-14l4 8c11 0 21 9 24 23 2 12-1 22-1 32z" />
      <circle cx="38" cy="33" r="2.6" fill={ink.detail} stroke="none" />
      <circle cx="25.5" cy="46" r="1.6" fill={ink.detail} stroke="none" />
      <path d="M53 25c9 6 14 17 14 31" stroke={ink.detail} fill="none" strokeWidth="2.4" />
      {base}
    </>
  ),
  Q: () => (
    <>
      <path d="M32 64H68l3 12H29z" />
      <path d="M31 64l-7-34 10 20 3-28 7 24 6-28 6 28 7-24 3 28 10-20-7 34z" />
      <circle cx="24" cy="29" r="4" />
      <circle cx="37" cy="21" r="4" />
      <circle cx="50" cy="16" r="4" />
      <circle cx="63" cy="21" r="4" />
      <circle cx="76" cy="29" r="4" />
      {base}
    </>
  ),
  K: () => (
    <>
      <path d="M30 63h40l2 13H28z" />
      <path d="M30 63c-9-12-5-25 8-23 5 1 9 4 12 10 3-6 7-9 12-10 13-2 17 11 8 23z" />
      <path d="M50 50c-4-7-4-16 0-21 4 5 4 14 0 21z" />
      <path d="M47 6h6v8h6v6h-6v8h-6v-8h-6v-6h6z" />
      {base}
    </>
  ),
}

function make(code: PieceCode): FC<{ className?: string }> {
  const ink = code[0] === 'w' ? WHITE : BLACK
  const draw = SHAPES[code[1]]
  const Piece: FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill={ink.fill} stroke={ink.line} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        {draw(ink)}
      </g>
    </svg>
  )
  Piece.displayName = `Classic${code}`
  return Piece
}

const CODES: PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

export const classic: SkinDef = {
  id: 'classic',
  labelKey: 'skin_classic',
  light: '#f0d9b5',
  dark: '#b58863',
  coordLight: '#b58863',
  coordDark: '#f0d9b5',
  pieces: Object.fromEntries(CODES.map((c) => [c, make(c)])) as SkinDef['pieces'],
}
