import { buildPieces, type SkinDef } from './types'
import { SHAPES, classic } from './classic'

// Gold (reward, points_1000): the classic Staunton silhouettes cast in metal — a vertical gilt gradient with a
// bright crown edge; white is pale champagne gold with a bronze rim, black is dark bronze with a gold rim.
type Ink = { top: string; mid: string; low: string; line: string; detail: string }
const WHITE: Ink = { top: '#fff6d6', mid: '#ecc964', low: '#b98a2a', line: '#5a3d0c', detail: '#5a3d0c' }
const BLACK: Ink = { top: '#6b4a1c', mid: '#3a2610', low: '#1c1208', line: '#e2b84f', detail: '#f1d27a' }

const draw = (kind: string, ink: Ink, _side: 'w' | 'b', uid: string) => (
  <g fill={`url(#${uid}g)`} stroke={ink.line} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    {SHAPES[kind]({ fill: '', line: ink.line, detail: ink.detail })}
  </g>
)

const defs = (ink: Ink, uid: string) => (
  <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stopColor={ink.top} />
    <stop offset="0.45" stopColor={ink.mid} />
    <stop offset="1" stopColor={ink.low} />
  </linearGradient>
)

export const gold: SkinDef = {
  id: 'gold',
  labelKey: 'skin_gold',
  only: 'pieces',
  unlock: 'points_1000',
  light: classic.light,
  dark: classic.dark,
  coordLight: classic.coordLight,
  coordDark: classic.coordDark,
  pieces: buildPieces('Gold', WHITE, BLACK, draw, defs),
}
