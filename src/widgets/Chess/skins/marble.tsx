import { buildPieces, type SkinDef } from './types'
import { SHAPES, classic } from './classic'

// Marble (reward, streak_30): the classic silhouettes carved from stone — Carrara white with grey veins,
// Nero Marquina black with pale veins. The veins are one pattern tile per piece, clipped by its own fill.
type Ink = { stone: string; vein: string; line: string; detail: string }
const WHITE: Ink = { stone: '#f3f0ea', vein: '#9a968f', line: '#2b2926', detail: '#2b2926' }
const BLACK: Ink = { stone: '#222327', vein: '#b9b6ae', line: '#0c0c0e', detail: '#e9e5dc' }

const draw = (kind: string, ink: Ink, _side: 'w' | 'b', uid: string) => (
  <g fill={`url(#${uid}m)`} stroke={ink.line} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    {SHAPES[kind]({ fill: '', line: ink.line, detail: ink.detail })}
  </g>
)

const defs = (ink: Ink, uid: string) => (
  <pattern id={`${uid}m`} patternUnits="userSpaceOnUse" width="100" height="100">
    <rect width="100" height="100" fill={ink.stone} />
    <g fill="none" stroke={ink.vein} strokeLinecap="round">
      <path d="M8 18c14 6 18 20 32 22s20 14 26 30 14 18 30 22" strokeWidth="2.2" opacity="0.9" />
      <path d="M40 40c-6 10-2 22-12 30" strokeWidth="1.5" opacity="0.75" />
      <path d="M66 70c8-4 16-2 26-10" strokeWidth="1.5" opacity="0.7" />
      <path d="M60 4c-4 10 4 18 0 30s6 16 14 20" strokeWidth="1.6" opacity="0.65" />
    </g>
  </pattern>
)

export const marble: SkinDef = {
  id: 'marble',
  labelKey: 'skin_marble',
  only: 'pieces',
  unlock: 'streak_30',
  light: classic.light,
  dark: classic.dark,
  coordLight: classic.coordLight,
  coordDark: classic.coordDark,
  pieces: buildPieces('Marble', WHITE, BLACK, draw, defs),
}
