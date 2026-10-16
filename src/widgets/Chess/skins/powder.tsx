import type { ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'

// Powder: flat dusty-rose / cherry silhouettes. Motif — the crowned profile:
// queen with a bun, king with a beard. Shared flared skirt, one thin rim for the set.
type Ink = { fill: string; line: string; cut: string }
const WHITE: Ink = { fill: '#fffafa', line: '#5a1420', cut: '#5a1420' }
const BLACK: Ink = { fill: '#24040a', line: '#ecd9db', cut: '#ecd9db' }

const skirt = (
  <>
    <path d="M28 84c3-5 9-8 15-8h14c6 0 12 3 15 8z" />
    <rect x="22" y="84" width="56" height="6" rx="1.5" />
  </>
)

// Neck rings + short stem into the skirt, under every head.
const stem = (top: number) => (
  <>
    <path d={`M45 ${top + 4}L42 72h16l-3-${68 - top}z`} />
    <rect x="37" y={top} width="26" height="4" rx="1.5" />
    <rect x="40" y="72" width="20" height="4" rx="1.5" />
  </>
)

const cut = (ink: Ink, d: string) => (
  <path d={d} fill="none" stroke={ink.cut} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
)

// Profile facing right: crown of head, brow, nose, lips, chin, throat.
const PROFILE =
  'M48 30c-8 0-14 6-14 14 0 6 3 10 7 13v5h14v-4c3 0 5-1 5-3v-3l2-1-1-2 1-1-1-1.5c1 0 3-1 2-2.5l-3-5c0-6-4-9-12-9z'

const SHAPES: Record<string, (ink: Ink) => ReactNode> = {
  P: () => (
    <>
      <circle cx="50" cy="48" r="11" />
      {stem(59)}
      {skirt}
    </>
  ),
  R: (ink) => (
    <>
      <path d="M38 64l2-24h20l2 24z" />
      <path d="M32 22h8v7h6v-7h8v7h6v-7h8v15l-5 4H37l-5-4z" />
      {stem(64)}
      {skirt}
      {cut(ink, 'M41 40h18')}
    </>
  ),
  B: (ink) => (
    <>
      <circle cx="50" cy="16" r="4.5" />
      <path d="M50 21c11 9 15 20 11 31H39c-4-11 0-22 11-31z" />
      {stem(52)}
      {skirt}
      {cut(ink, 'M56 29l-9 11')}
    </>
  ),
  N: (ink) => (
    <>
      <path d="M38 62c0-6 3-10 7-14-5 1-9 2-13 0-4-2-5-6-3-9l10-12c3-4 5-8 7-12l5 6c9 0 17 7 19 17 2 9 1 16-1 24z" />
      {stem(62)}
      {skirt}
      {cut(ink, 'M53 28c6 5 9 12 9 22')}
      <circle cx="40" cy="31" r="2.3" fill={ink.cut} stroke="none" />
    </>
  ),
  Q: (ink) => (
    <>
      <circle cx="35" cy="41" r="6.5" />
      <path d={PROFILE} />
      <path d="M36 28l-3-12 9 6 8-10 8 10 9-6-3 12z" />
      <path d="M50 18l3 4-3 4-3-4z" fill={ink.cut} stroke="none" />
      {stem(62)}
      {skirt}
      {cut(ink, 'M52 31c-7 2-11 8-10 16 0 3 1 6 3 9')}
    </>
  ),
  K: (ink) => (
    <>
      <path d={PROFILE} />
      <path d="M41 52c2 6 7 9 13 9 3 0 5-2 6-5l-4-1c-5 2-11 1-15-3z" />
      <path d="M35 29v-11l7 5 8-7 8 7 7-5v11z" />
      <rect x="47.5" y="2" width="5" height="13" rx="1" />
      <rect x="43.5" y="5.5" width="13" height="4.5" rx="1" />
      {stem(62)}
      {skirt}
      {cut(ink, 'M38 34c4 1 9 1 14-1')}
    </>
  ),
}

const draw = (kind: string, ink: Ink, className?: string) => (
  <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    <g fill={ink.fill} stroke={ink.line} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
      {SHAPES[kind](ink)}
    </g>
  </svg>
)

export const powder: SkinDef = {
  id: 'powder',
  labelKey: 'skin_powder',
  light: '#cbb0b4',
  dark: '#6e1a2a',
  coordLight: '#6e1a2a',
  coordDark: '#cbb0b4',
  frame: '#3a0a14',
  pieces: buildPieces('Powder', WHITE, BLACK, draw),
}
