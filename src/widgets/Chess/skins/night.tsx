import type { ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'

// Night: flat monochrome silhouettes on a deep navy board. White = solid salmon,
// black = hollow dark-salmon contour. One plinth, one cut-line weight for the whole set.
type Ink = { fill: string; line: string; lineWidth: number; cut: string }
const WHITE: Ink = { fill: '#e8a48e', line: 'none', lineWidth: 0, cut: '#141a2b' }
const BLACK: Ink = { fill: '#2a1a22', line: '#d27f69', lineWidth: 4.5, cut: '#d27f69' }

const plinth = <rect x="22" y="82" width="56" height="8" rx="2.5" />

// Cut lines are drawn on top in the "negative" colour, like the slits in the reference.
const cut = (ink: Ink, d: string) => (
  <path d={d} fill="none" stroke={ink.cut} strokeWidth="3.2" strokeLinecap="round" />
)

const SHAPES: Record<string, (ink: Ink) => ReactNode> = {
  P: () => (
    <>
      <circle cx="50" cy="41" r="12.5" />
      <path d="M43 52h14l8 30H35z" />
      {plinth}
    </>
  ),
  R: (ink) => (
    <>
      <path d="M29 18h10v9h6v-9h10v9h6v-9h10v21l-7 5v27l5 11H31l5-11V44l-7-5z" />
      {plinth}
      {cut(ink, 'M37 45h26')}
    </>
  ),
  B: (ink) => (
    <>
      <circle cx="50" cy="12" r="5" />
      <path d="M50 17c12 9 17 20 13 31H37c-4-11 1-22 13-31z" />
      <rect x="34" y="47" width="32" height="6" rx="3" />
      <path d="M42 53h16l7 29H35z" />
      {plinth}
      {cut(ink, 'M57 25l-9 11')}
    </>
  ),
  N: (ink) => (
    <>
      <path d="M31 82l4-12c2-7 7-13 12-19-6 2-11 4-16 3-5-1-8-6-6-10l12-16c3-4 5-9 7-15l6 7c14 1 24 13 26 29 2 12 0 23-2 33z" />
      {plinth}
      {cut(ink, 'M54 26c8 7 12 17 12 30')}
      <circle cx="40" cy="31" r="2.8" fill={ink.cut} stroke="none" />
    </>
  ),
  Q: (ink) => (
    <>
      <circle cx="22" cy="28" r="5.5" />
      <circle cx="50" cy="16" r="5.5" />
      <circle cx="78" cy="28" r="5.5" />
      <path d="M31 72l-9-42 15 17 13-28 13 28 15-17-9 42z" />
      <rect x="30" y="72" width="40" height="10" rx="2" />
      {plinth}
      {cut(ink, 'M34 72h32')}
    </>
  ),
  K: (ink) => (
    <>
      <rect x="46.5" y="9" width="7" height="24" rx="1.5" />
      <rect x="39" y="15" width="22" height="7" rx="1.5" />
      <path d="M50 35c-15 0-24 10-24 23 0 10 4 17 9 24h30c5-7 9-14 9-24 0-13-9-23-24-23z" />
      {plinth}
      {cut(ink, 'M41 62c5 6 13 6 18 0')}
    </>
  ),
}

const draw = (kind: string, ink: Ink) => (
  <g fill={ink.fill} stroke={ink.line} strokeWidth={ink.lineWidth} strokeLinejoin="round">
    {SHAPES[kind](ink)}
  </g>
)

export const night: SkinDef = {
  id: 'night',
  labelKey: 'skin_night',
  light: '#1b2236',
  dark: '#141a2b',
  coordLight: '#5d6784',
  coordDark: '#5d6784',
  frame: '#0e1220',
  pieces: buildPieces('Night', WHITE, BLACK, draw),
}
