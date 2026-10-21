import { buildPieces, type SkinDef } from './types'
import { SHAPES } from './night'
import { classic } from './classic'

// Night grid (reward, first_win_l8 — beat the strongest bot): the Night silhouettes drawn on a blueprint —
// a fine coordinate grid inside every piece. White is chalk paper with ink-blue lines, black is midnight with steel lines.
type Ink = { paper: string; grid: string; line: string; cut: string }
const WHITE: Ink = { paper: '#eef2fb', grid: '#9fb0d6', line: '#1d2a4d', cut: '#1d2a4d' }
const BLACK: Ink = { paper: '#121a2e', grid: '#3f5384', line: '#8fa6dc', cut: '#8fa6dc' }

const draw = (kind: string, ink: Ink, _side: 'w' | 'b', uid: string) => (
  <g fill={`url(#${uid}n)`} stroke={ink.line} strokeWidth="2.6" strokeLinejoin="round">
    {SHAPES[kind]({ fill: '', line: ink.line, lineWidth: 2.6, cut: ink.cut })}
  </g>
)

const defs = (ink: Ink, uid: string) => (
  <pattern id={`${uid}n`} patternUnits="userSpaceOnUse" width="8" height="8">
    <rect width="8" height="8" fill={ink.paper} />
    <path d="M8 0H0V8" fill="none" stroke={ink.grid} strokeWidth="0.8" />
  </pattern>
)

export const nightgrid: SkinDef = {
  id: 'nightgrid',
  labelKey: 'skin_nightgrid',
  only: 'pieces',
  unlock: 'first_win_l8',
  light: classic.light,
  dark: classic.dark,
  coordLight: classic.coordLight,
  coordDark: classic.coordDark,
  pieces: buildPieces('NightGrid', WHITE, BLACK, draw, defs),
}
